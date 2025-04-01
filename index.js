const { getCPUUsage, errorLog, debugLog, cleanupChromeProcesses, DEBUG, getMemoryUsage } = require('./helper');
const { URL } = require('url');

const fastify = require('fastify')({
  logger: DEBUG,
  // Add compression support
  compression: {
    global: true,
    encodings: ['gzip', 'deflate']
  }
});

fastify.register(require('@fastify/compress'));
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

const API_KEY = process.env.API_KEY || null;
const BROWSER_TIMEOUT = 5000;
const EXECUTABLE_PATH = process.env.EXECUTABLE_PATH || '/usr/bin/chromium';
const DEFAULT_PAGE_TIMEOUT_MS = 60000;
const DEFAULT_WAIT_UNTIL_CONDITION = 'networkidle2';
const DEFAULT_USER_AGENT = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36';
// Resource types to block
const BLOCKED_RESOURCES = new Set(['image', 'media', 'font']);
// Add blocked JS URLs - will match from end of URL
const BLOCKED_JS = [];
const SERVER_NAME = process.env.SERVER_NAME || 'proxy-server';
const MAX_CONCURRENT_REQUESTS = process.env.MAX_CONCURRENT_REQUESTS || 8; // Adjust as needed
const MAX_CPU_UTILIZATION_LIMIT = process.env.MAX_CPU_UTILIZATION_LIMIT || 80;
const CLEANUP_CHROME_PROCESS_INTERVAL = process.env.CLEANUP_CHROME_PROCESS_INTERVAL || 30000;



const CHROME_CACHE_SIZE = process.env.CHROME_CACHE_SIZE || (100 * 1024 * 1024).toString(); // 100MB default
const CHROME_MEDIA_CACHE_SIZE = process.env.CHROME_MEDIA_CACHE_SIZE || (100 * 1024 * 1024).toString();


/** we calculate CPU usage for last 10 seconds , and then we calculate the average */
let CpuUsage = [];
const CPU_USAGE_SAMPLE_SIZE = process.env.CPU_USAGE_SAMPLE_SIZE || 10;

function calculateAverageCpuUsage() {
  const { cpuUsage, cpuCount, isError } = getCPUUsage();
  if (isError) {
    return false;
  }
  CpuUsage.push(cpuUsage / cpuCount);
  while (CpuUsage.length > CPU_USAGE_SAMPLE_SIZE) {
    CpuUsage.shift();
  }
  return CpuUsage.reduce((a, b) => a + b, 0) / CpuUsage.length;

}
setInterval(calculateAverageCpuUsage, 1000);


function isUnderPressure() {
  const averageCpuUsage = calculateAverageCpuUsage();
  if (averageCpuUsage === false) {
    return false;
  }
  return averageCpuUsage > MAX_CPU_UTILIZATION_LIMIT;
}

// Essential flags
const CORE_FLAGS = [
  '--no-sandbox',                    // Required for running in Docker/CI
  '--disable-setuid-sandbox',        // Required with no-sandbox
  '--disable-web-security',          // Bypass CORS and other security (use with caution)
  '--disable-blink-features=AutomationControlled',  // Critical for bot detection bypass
  '--disable-features=IsolateOrigins',
  '--window-size=1920,1080',        // Makes browser look more realistic

  // Performance flags
  '--disable-gpu',                   // Reduces resource usage
  '--disable-dev-shm-usage',        // Prevents crashes in limited memory environments
  '--no-zygote',                    // Better for containerized environments

  // Memory optimization
  '--single-process',               // Reduces memory usage
  // '--disable-extensions',           // Reduces overhead
  // '--disable-background-networking', // Reduces background activity
  '--ignore-certificate-errors',
  '--ignore-certificate-errors-spki-list',
  '--allow-insecure-localhost',
  // '--disable-http2',
  '--disk-cache-size=' + CHROME_CACHE_SIZE,
  '--media-cache-size=' + CHROME_MEDIA_CACHE_SIZE,
  '--aggressive-cache-discard',
];

let browserInstance = null;
async function getBrowser() {
  try {
    // Check if browser exists and is actually connected
    if (!browserInstance || !browserInstance.isConnected()) {
      // Cleanup old instance if it exists
      if (browserInstance) {
        try {
          await browserInstance.close();
        } catch (e) {
          debugLog('Error closing old browser:', e);
        }
        browserInstance = null;
      }

      // Create new browser with retry logic
      for (let i = 0; i < 3; i++) {
        try {
          browserInstance = await puppeteer.launch({
            headless: 'new',
            args: CORE_FLAGS,
            ignoreHTTPSErrors: true,
            pipe: false,
            executablePath: EXECUTABLE_PATH,
            timeout: BROWSER_TIMEOUT
          });
          break;
        } catch (e) {
          debugLog(`Browser launch attempt ${i + 1} failed:`, e);
          await new Promise(r => setTimeout(r, 1000)); // Wait before retry
        }
      }

      if (!browserInstance) {
        throw new Error('Failed to launch browser after retries');
      }

      // Add disconnect handler
      browserInstance.on('disconnected', () => {
        debugLog('Browser disconnected, will recreate on next request');
        browserInstance = null;
      });
    }

    return browserInstance;
  } catch (err) {
    errorLog('Browser creation failed:', err);
    browserInstance = null;
    process.exit(1);
    throw err;
  }
}


function sanitizeHeaderValue(value) {
  if (!value) return '';

  return value
    // Convert to string in case of numbers/other types
    .toString()
    // Replace all types of newlines
    .replace(/\r?\n|\r/g, ' ')
    // Replace tabs
    .replace(/\t/g, ' ')
    // // Replace multiple spaces with single space
    // .replace(/\s+/g, ' ')
    // // Remove non-printable characters
    // .replace(/[\x00-\x1F\x7F]/g, '')
    // // Remove potentially dangerous characters
    // .replace(/[()<>@,;:\\"/[\]?={}]/g, '')
    .trim();
}

async function prepareHeader(reply, response) {
  if (!response) {
    return;
  }

  try {
    debugLog(`Preparing Header for response.url: ${response.url()}`);
    const headers = response.headers();

    // Problematic headers that should be skipped
    const skipHeaders = new Set([
      'set-cookie',
      'transfer-encoding',
      'connection',
      'keep-alive',
      'upgrade',
      'proxy-authenticate',
      'proxy-authorization',
      'content-encoding'
    ]);

    for (const [key, value] of Object.entries(headers)) {
      const lowerKey = key.toLowerCase();
      if (!skipHeaders.has(lowerKey)) {
        try {
          const sanitizedValue = sanitizeHeaderValue(value);
          if (sanitizedValue) {
            // debugLog(`Setting header: <${key}> - <${sanitizedValue}>`);
            reply.header(key, sanitizedValue);
          }
        } catch (error) {
          debugLog(`Error setting header: ${key} - ${error.message}`);
        }
      }
    };

    debugLog(`Header prepared for response.url: ${response.url()}`);
  } catch (error) {
    debugLog(`Error preparing header: ${error.message}`);
    throw error;
  }
}


const isValidUrl = function (url) {
  try {
    new URL(url.trim()); // This will throw if URL is invalid
    return url.startsWith('http://') || url.startsWith('https://');
  } catch {
    return false;
  }
}


// Block unsafe URLs, private IPs, and invalid URLs
async function blockUnsafeUrls(url, reply) {
  try {
    // URL validation
    if (!url) {
      throw {
        message: 'URL parameter is required',
        status: 400
      };
    }

    if (!isValidUrl(url)) {
      throw {
        message: 'Invalid URL format. Must be a valid HTTP/HTTPS URL',
        status: 400
      };
    }

    const parsedUrl = new URL(url);
    const hostname = parsedUrl.hostname;
    //check further
    //TODO: check if the hostname is a private IP
  } catch (error) {
    throw {
      message: 'Invalid URL format',
      status: 400
    };
  }

  //trim url
  url = url.trim();

  return url;
}

const isMatchesAny = function (url, list) {
  // debugLog(`Checking if ${url} matches any of list`, list);
  // Filter out empty strings and check if URL ends with any of the patterns
  return list.filter(Boolean).some(item => url.endsWith(item));
}

/**
 * Get page content safely
 * This function stops all JavaScript execution and returns the page content
 * It also handles the case where the page is not loaded yet
 */
const getPageContentSafely = async (page) => {
  try {
    // Stop all JavaScript execution
    await page.setJavaScriptEnabled(false);

    //wait for 50 ms
    await new Promise(resolve => setTimeout(resolve, 50));
    // Get content with short timeout
    const content = await Promise.race([
      page.content(),
      new Promise((_, reject) => setTimeout(() => reject('Content fetch timeout'), 500))
    ]);

    // if content is not null and contains <body, return content
    if (content && content.includes('<body')) {
      return content;
    }

    return null;
  } catch (e) {
    return null;
  }
};

fastify.get('/*', async (request, reply) => {
  const targetUrl = `${request.url}`;
  let url = targetUrl;

  //request url does not start with http
  if (!request.url.startsWith('http')) {
    if (targetUrl === '/ok') {
      try {
        const browser = await getBrowser();
        if (!browser || !browser.isConnected()) {
          throw new Error('Browser not connected');
        }
        return reply.code(200).send({ status: 'ok' });
      } catch (e) {
        return reply.code(503).send({ status: 'error', message: e.message });
      }
    }

    //user can pass URL as query param also, but not a request as proxy url
    if (request.query.render_url) {
      url = request.query.render_url;
    } else {
      return reply.code(400).send({ error: 'render_url is required' });
    }
  }

  //check if api key is present
  if (API_KEY) {
    const apiKey = request.headers['x-api-key'];
    if (apiKey !== API_KEY) {
      console.error(`Unauthorized request for ${url} with api key: ${apiKey} and expected api key: ${API_KEY}`);
      return reply.code(401).send({ error: 'Unauthorized' });
    }
  }

  try {
    url = await blockUnsafeUrls(url, reply);
  } catch (error) {
    errorLog('URL blocked by safety checks');
    return reply.code(error.status).send({ error: error.message });
  }

  // use client user agent for puppeteer
  const userAgent = request.headers['user-agent'] || DEFAULT_USER_AGENT;
  const page_timeout_ms = parseInt(request.headers['x-page-timeout-ms']) || DEFAULT_PAGE_TIMEOUT_MS;
  const wait_until_condition = [request.headers['x-wait-until-condition'] || DEFAULT_WAIT_UNTIL_CONDITION];
  const toBlockJS = request.headers['x-block-js'] || '';
  const followRedirects = request.headers['x-follow-redirects'] || false;

  const toBlockJSArray = toBlockJS.split(',');
  // merge with default blocked JS
  const JS_BLOCK_LIST = [...BLOCKED_JS, ...toBlockJSArray];

  const browser = await getBrowser();

  if (!browser) {
    errorLog('Browser not created');
    return reply.code(503).send({ error: 'Failed to create browser, please try again later' });
  }
  const page = await browser.newPage();
  if (!page) {
    errorLog('New page not created');
    // await closePageAndBrowser(null, browser);
    return reply.code(503).send({ error: 'Failed to create page, please try again later' });
  }

  // This is to actually close the page after sufficient time
  // setTimeout(async () => {
  //   debugLog('Closing page for url on timeout: ', url);
  //   await closePageAndBrowser(page);
  // }, page_timeout_ms * 10);

  try {
    // Monitor for page crashes
    page.on('error', err => {
      errorLog('Page error:', err);
      // We need not to throw error here, because we want to continue the request
      // throw err;
    });

    await page.setUserAgent(userAgent);
    await page.setExtraHTTPHeaders({
      'Accept-Language': '*',
      'Accept': '*/*',
      'Accept-Encoding': '',
      'Connection': 'keep-alive',
      'Referer': url,  // Set initial referer, some hosting return 403 if not set
    });

    // Add these before making requests
    await page.setViewport({
      width: 1920,
      height: 1080
    });

    let redirectResponse = null;
    let isRedirected = false;

    await page.setRequestInterception(true);

    // instead of aborting the main navigation request, we will respond gracefully
    // this will help in avoiding the Navigation Errors
    const respondGracefully = function (request) {
      request.respond({
        status: 200,
        body: 'Hello, world!'
      });
    }

    page.on('request', childRequest => {
      const resourceType = childRequest.resourceType();
      // if we already have a redirect response, abort all the request
      if (!followRedirects && isRedirected) {
        respondGracefully(childRequest);
      } else if (!followRedirects && childRequest.isNavigationRequest() && childRequest.redirectChain().length > 0) {
        debugLog(`Redirect detected: ${childRequest.url()}, aborting...`);
        isRedirected = true;
        respondGracefully(childRequest);

      } else if (BLOCKED_RESOURCES.has(resourceType)) {
        childRequest.abort();
      } else if (resourceType === 'script' && isMatchesAny(childRequest.url(), JS_BLOCK_LIST)) {
        debugLog(`Blocked JS file: ${childRequest.url()}`);
        childRequest.abort();
      } else {
        childRequest.continue();
      }
    });

    page.on('response', response => {
      // Add null check before accessing response
      if (!response) {
        errorLog('No response received from page for url: ', url);
        return null;
      }

      if (response.url() === url && response.status() >= 300 && response.status() < 400) {
        // its a redirect
        debugLog(`Redirect detected: ${response.url()}`);
        redirectResponse = response;
        isRedirected = true;
      }
    });

    // Navigate with timeout
    let error = null;
    let response = null;
    let pageContent = null;
    try {
      response = await Promise.race([
        page.goto(url, {
          waitUntil: wait_until_condition,
          timeout: page_timeout_ms
        }),
        new Promise((_, reject) =>
          setTimeout(async () => {
            const partialHtml = await getPageContentSafely(page);
            reject({ name: 'TimeoutError', partialHtml });
          }, page_timeout_ms)
        )
      ]);

      // if response is 200, then get the page content, else don't get the page content
      if (response && response.status() === 200) {
        pageContent = await getPageContentSafely(page);
      }

    } catch (err) {
      error = err;
      pageContent = error.partialHtml || await getPageContentSafely(page);
      await closePageAndBrowser(page);
    }

    if (!followRedirects && isRedirected && redirectResponse) {
      debugLog('Returning initial response for redirect');
      // For redirects, send response without HTML
      await prepareHeader(reply, redirectResponse);
      return reply.code(redirectResponse.status()).send();
    }

    if (error) {
      // handle timeout error only
      if (error.name === 'TimeoutError' && pageContent) {
        debugLog('Returning partial content for timeout');
        reply.header('Content-Type', 'text/html; charset=utf-8');
        reply.header('X-Timeout-Warning', 'Page load timed out but partial content was retrieved');
        return reply.code(200).send(pageContent);
      }
      // other errors
      throw error;
    }

    if (!response) {
      throw new Error('ERR_NO_RESPONSE');
    }

    // For successful responses, include rendered HTML
    await prepareHeader(reply, response);
    reply.header('Content-Type', 'text/html; charset=utf-8');
    return reply.code(response.status()).send(pageContent);

  } catch (error) {
    return handlePageError(error, reply, url);
  } finally {
    await closePageAndBrowser(page);
  }
});

async function handlePageError(error, reply, url, response) {
  // Check the full error message since the error name might be just "Error"
  const errorMessage = error.message || '';

  if (error.name.includes('TimeoutError') || errorMessage.includes('timeout')) {
    return reply.code(504).send({
      error: 'Gateway Timeout'
    });
  }

  if (errorMessage.includes('ERR_EMPTY_RESPONSE')) {
    return reply.code(502).send({
      error: "No response received from the server"
    });
  }

  if (errorMessage.includes('ERR_NO_RESPONSE') || errorMessage.includes('ERR_ABORTED')) {
    return reply.code(502).send({
      error: "No response received from the server"
    });
  }

  if (errorMessage.includes('ERR_CONNECTION_CLOSED')) {
    return reply.code(502).send({
      error: 'Target server closed the connection unexpectedly',
    });
  }

  if (errorMessage.includes('ERR_SSL_PROTOCOL_ERROR')) {
    return reply.code(525).send({
      error: 'The SSL connection could not be established with the server',
    });
  }

  // Only log if none of the above conditions match
  errorLog(error.name, error.message, url, response?.status);
  return reply.code(response?.status || 503).send({
    error: `${error.name}: ${error.message}`
  });
}

async function closePageAndBrowser(page, browser) {

  try {
    if (page && !page.isClosed()) {
      await page.removeAllListeners();
      await page.close().catch(() => { });
    }
  } catch (error) {
    debugLog('Error in closePageAndBrowser:', error);
  }

  if (browser) {
    if (!browser.closed) {
      debugLog('Closing browser');
      await browser.close().catch(e => { });
    }
    if (browser && browser.process() != null && !browser.process().killed) {
      debugLog('Killing browser process');
      browser.process().kill('SIGINT');
    }
  }
}


fastify.listen({ port: 3000, host: '0.0.0.0' }, async (err) => {
  try {
    const browser = await getBrowser();
  } catch (e) {
    console.error(e);
    process.exit(1);
  }

  if (err) {
    console.error(err);
    fastify.log.error(err);
    process.exit(1);
  }
  console.log('Server running on port 3000');
});


// Run cleanup every minute
setInterval(cleanupChromeProcesses, CLEANUP_CHROME_PROCESS_INTERVAL);
// Also run cleanup on process exit
process.on('SIGINT', async () => {
  await cleanupChromeProcesses();
  process.exit();
});

process.on('SIGTERM', async () => {
  await cleanupChromeProcesses();
  process.exit();
});


// Track request start times
const requestTimes = new Map();

let activeRequests = 0;
let totalRequests = 0;

fastify.addHook('onRequest', (request, reply, done) => {
  console.log('CPU Usage:', calculateAverageCpuUsage().toFixed(2) + '%');
  if (isUnderPressure()) {
    return reply.status(503).send({
      error: 'Service Unavailable',
      message: 'Server is under high load, please try again later',
      retryAfter: 30
    });
  }

  if (activeRequests >= MAX_CONCURRENT_REQUESTS) {
    reply.status(429).send({ error: 'Too many requests, try again later' });
    return;
  }

  requestTimes.set(request.id, process.hrtime());
  activeRequests++;
  totalRequests++;
  done();
});

// read from env

fastify.addHook('onSend', (request, reply, payload, done) => {
  try {
    let timeTaken = '(unknown)';
    if (requestTimes.has(request.id)) {
      activeRequests = Math.max(0, activeRequests - 1);
      const startTime = requestTimes.get(request.id);
      requestTimes.delete(request.id);
      const [seconds, nanoseconds] = process.hrtime(startTime);
      timeTaken = (seconds * 1000 + nanoseconds / 1e6).toFixed(0); // Convert to ms
    }

    if (request.query.render_url) {
      const logData = {
        RENDER_LOGS: SERVER_NAME,
        status: reply.statusCode,
        time: `${timeTaken}ms`,
        url: request.query.render_url,
        active_requests: activeRequests,
      };

      // Get error from sent response
      if (reply.statusCode >= 400) {
        try {
          const body = JSON.parse(payload);
          logData.error = body.error;
          logData.error_message = body.message;
        } catch (e) {
          // Handle if payload isn't JSON
        }
      }

      const LOG_STRING = JSON.stringify(logData);
      console.log(LOG_STRING);
    }
  } catch (e) {
    //console.error(e);
  }

  done();
});

fastify.addHook('onRequestAbort', (request) => {
  if (requestTimes.delete(request.id)) {
    activeRequests = Math.max(0, activeRequests - 1);

    if (request.query.render_url) {

      const logData = {
        RENDER_LOGS: SERVER_NAME,
        status: 'onRequestAbortHook',
        url: request.query.render_url,
        active_requests: activeRequests,
      };

      const LOG_STRING = JSON.stringify(logData);
      console.log(LOG_STRING);
    }
  }
});

fastify.addHook('onTimeout', (request, reply) => {
  if (requestTimes.delete(request.id)) {
    activeRequests = Math.max(0, activeRequests - 1);
    if (request.query.render_url) {

      const logData = {
        RENDER_LOGS: SERVER_NAME,
        status: 'onTimeoutHook',
        url: request.query.render_url,
        active_requests: activeRequests,
      };

      const LOG_STRING = JSON.stringify(logData);
      console.log(LOG_STRING);
    }
  }
});

fastify.addHook('onError', (request, reply, error) => {
  if (requestTimes.delete(request.id)) {
    activeRequests = Math.max(0, activeRequests - 1);
    if (request.query.render_url) {

      const logData = {
        RENDER_LOGS: SERVER_NAME,
        status: 'onErrorHook',
        url: request.query.render_url,
        active_requests: activeRequests,
        error: error.name,
        error_message: error.message,
        error_stack: error.stack,
      }

      const LOG_STRING = JSON.stringify(logData);
      console.log(LOG_STRING);
    }
  }
});



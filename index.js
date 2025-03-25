const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

const { URL } = require('url');
const { exec, execSync } = require('child_process');
const fastify = require('fastify')({
  logger: true,
  // Add compression support
  compression: {
    global: true,
    encodings: ['gzip', 'deflate']
  }
});

fastify.register(require('@fastify/compress'));

// Resource types to block
const BLOCKED_RESOURCES = new Set(['image', 'media', 'font']);

// Add blocked JS URLs - will match from end of URL
const BLOCKED_JS = [
];

// Add debug flag
const DEBUG = process.env.DEBUG === 'true';
const API_KEY = process.env.API_KEY || null;



// Add debug logging function
function debugLog(...args) {
  if (DEBUG) {
    console.log('[DEBUG]', ...args);
  }
}

function errorLog(...args) {
  console.log('[ERROR]', ...args);
  console.error(args);
}

// Browser management
const DEFAULT_PAGE_TIMEOUT_MS = 60000;
const DEFAULT_WAIT_UNTIL_CONDITION = 'networkidle2';
const DEFAULT_USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';


const BROWSER_TIMEOUT = 5000;
// Essential flags
const CORE_FLAGS = [
  '--no-sandbox',                    // Required for running in Docker/CI
  '--disable-setuid-sandbox',        // Required with no-sandbox
  '--disable-web-security',          // Bypass CORS and other security (use with caution)
  '--disable-blink-features=AutomationControlled',  // Critical for bot detection bypass
  '--window-size=1920,1080',        // Makes browser look more realistic

  // Performance flags
  '--disable-gpu',                   // Reduces resource usage
  '--disable-dev-shm-usage',        // Prevents crashes in limited memory environments
  '--no-zygote',                    // Better for containerized environments

  // Memory optimization
  '--single-process',               // Reduces memory usage
  // '--disable-extensions',           // Reduces overhead
  // '--disable-background-networking', // Reduces background activity
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
            executablePath: '/usr/bin/chromium'
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

  setTimeout(async () => {
    debugLog('Closing page for url on timeout: ', url);
    await closePageAndBrowser(page);
  }, page_timeout_ms + 10000);

  try {
    // Monitor for page crashes
    page.on('error', err => {
      errorLog('Page error:', err);
      throw err;
    });

    await page.setUserAgent(userAgent);

    let redirectResponse = null;
    let isRedirected = false;

    await page.setRequestInterception(true);

    page.on('request', childRequest => {
      const resourceType = childRequest.resourceType();
      // if we already have a redirect response, abort all the request
      if (isRedirected) {
        childRequest.abort();
      } else if (childRequest.isNavigationRequest() && childRequest.redirectChain().length > 0) {
        debugLog(`Redirect detected: ${childRequest.url()}, aborting...`);
        isRedirected = true;
        childRequest.abort();
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

    // Set request headers
    // debugLog(`Request headers: ${JSON.stringify(request.headers)}`);
    // // Generates ERROR
    // await page.setExtraHTTPHeaders(request.headers);

    // Navigate with timeout
    let error = null;
    let response = null;
    try {
      [error, response] = await Promise.all([
        page.waitForNavigation({ waitUntil: wait_until_condition, timeout: page_timeout_ms }).then(() => { }).catch(err => err),
        page.goto(url)
      ]);
    } catch (err) {
      error = err;
    }

    // Add a small delay to ensure the page is stable
    await new Promise(resolve => setTimeout(resolve, 100));

    if (isRedirected && redirectResponse) {
      debugLog('Returning initial response for redirect');
      // For redirects, send response without HTML
      if (redirectResponse) {
        await prepareHeader(reply, redirectResponse);
        return reply.code(redirectResponse.status()).send();
      }
    }

    if (page.isClosed()) {
      throw new Error('Page is closed');
    }

    if (error) {
      // handle timeout error
      if (error.name === 'TimeoutError') {
        const html = await page.content();

        // have some content
        if (html && html.length > 0) {
          debugLog('Returning partial content for timeout');
          reply.header('Content-Type', 'text/html; charset=utf-8');
          reply.header('X-Timeout-Warning', 'Page load timed out but partial content was retrieved');
          return reply.code(200).send(html);
        } else {
          errorLog(`Page load timed out for ${url} timeout: ${page_timeout_ms}, No content returned`);
          return reply.code(504).send({ error: 'Gateway Timeout' });
        }
      }

      // other errors
      errorLog(`Navigation error: ${error.message} for url: ${url}`);
      throw error;
    }

    // For successful responses, include rendered HTML
    if (!response) {
      throw new Error('No response received');
    }

    const html = await page.content();
    await prepareHeader(reply, response);
    reply.header('Content-Type', 'text/html; charset=utf-8');
    return reply.code(response.status()).send(html);

  } catch (error) {
    errorLog(error);
    return reply.code(503).send({
      error: `${error.name}: ${error.message}`
    });

  } finally {
    await closePageAndBrowser(page);
  }
});

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
// the first time it runs, it should clean up all the chrome processes
cleanupChromeProcesses();



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

// Add these functions
function getZombieProcesses() {
  try {
    // Find chrome processes that are zombies (defunct)
    const cmd = "ps aux | grep chrome | grep defunct | awk '{print $2}'";
    return execSync(cmd).toString().trim().split('\n').filter(Boolean);
  } catch (error) {
    debugLog('Error getting zombie processes:', error);
    return [];
  }
}

function getOrphanedChromeProcesses() {
  try {
    // Find chrome processes running longer than 5 minutes
    const cmd = "ps -eo pid,etimes,cmd | grep chrom | grep -v grep | awk '$2 > 300 {print $1}'";
    return execSync(cmd).toString().trim().split('\n').filter(Boolean);
  } catch (error) {
    debugLog('Error getting orphaned processes:', error);
    return [];
  }
}

async function cleanupChromeProcesses() {
  try {
    // Kill zombie processes
    const zombies = getZombieProcesses();
    if (zombies.length) {
      debugLog(`Found ${zombies.length} zombie chrome processes`);
      zombies.forEach(pid => {
        try {
          process.kill(parseInt(pid), 'SIGKILL');
          debugLog(`Killed zombie process ${pid}`);
        } catch (e) {
          if (e.code !== 'ESRCH') {
            debugLog(`Failed to kill zombie ${pid}:`, e);
          }
        }
      });
    }

    // Kill orphaned processes
    const orphaned = getOrphanedChromeProcesses();
    if (orphaned.length) {
      debugLog(`Found ${orphaned.length} orphaned chrome processes`);
      orphaned.forEach(pid => {
        try {
          process.kill(parseInt(pid), 'SIGKILL');
          debugLog(`Killed orphaned process ${pid}`);
        } catch (e) {
          debugLog(`Failed to kill orphaned ${pid}:`, e);
        }
      });
    }

    // // Cleanup any remaining headless chrome instances
    // exec('pkill -f "(chrome)?(--headless)"', (err) => {
    //   if (err && err.code !== 1) debugLog('Chrome cleanup error:', err);
    // });
  } catch (error) {
    debugLog('Cleanup error:', error);
  }
}

// Run cleanup every minute
setInterval(cleanupChromeProcesses, 60000);

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
const SERVER_NAME = process.env.SERVER_NAME || 'proxy-server';
const MAX_CONCURRENT_REQUESTS = process.env.MAX_CONCURRENT_REQUESTS || 10; // Adjust as needed
let activeRequests = 0;

fastify.addHook('onRequest', (request, reply, done) => {
  requestTimes.set(request.id, process.hrtime());
  if (activeRequests >= MAX_CONCURRENT_REQUESTS) {
    reply.status(429).send({ error: 'Too many requests, try again later' });
    return;
  }
  activeRequests++;

  done();
});

// read from env

fastify.addHook('onResponse', (request, reply) => {

  activeRequests--;

  const startTime = requestTimes.get(request.id);
  const [seconds, nanoseconds] = process.hrtime(startTime);
  const timeTaken = (seconds * 1000 + nanoseconds / 1e6).toFixed(2); // Convert to ms
  requestTimes.delete(request.id);

  if (request.query.render_url) {
    const logData = {
      RENDER_LOGS: SERVER_NAME,
      status: reply.statusCode,
      time: `${timeTaken}ms`,
      url: request.query.render_url,
      time: Date.now(),
      start_time: startTime,
      active_requests: activeRequests,
    };

    if (reply.raw._error?.message) {
      logData.error = reply.raw._error?.message;
    }

    const LOG_STRING = JSON.stringify(logData);
    console.log(LOG_STRING);
  }
});
const fastify = require('fastify')();
const puppeteer = require('puppeteer');
const { URL } = require('url');

// Resource types to block
const BLOCKED_RESOURCES = new Set(['image', 'media', 'font']);



// Add debug flag
const DEBUG = process.env.DEBUG === 'true';

// Add debug logging function
function debugLog(...args) {
  if (DEBUG) {
    console.log('[DEBUG]', ...args);
  }
}

// Browser management
let browserInstance = null;
let requestCount = 0;
const PAGE_LIMIT_PER_BROWSER_INSTANCE = 1;
const PAGE_TIMEOUT_MS = 30000;
async function getBrowser() {
  if (!browserInstance || requestCount >= PAGE_LIMIT_PER_BROWSER_INSTANCE) {
    debugLog(`Creating new browser instance. Previous count: ${requestCount}`);
    if (browserInstance) {
      await browserInstance.close();
    }
    browserInstance = await puppeteer.launch({
      headless: 'new', // or true/false depending on your Puppeteer version
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    requestCount = 0;
    debugLog('New browser instance created');
  }
  requestCount++;
  debugLog(`Current request count: ${requestCount}`);
  return browserInstance;
}

// Cleanup on shutdown
process.on('SIGINT', async () => {
  if (browserInstance) {
    await browserInstance.close();
  }
  process.exit();
});

process.on('SIGTERM', async () => {
  if (browserInstance) {
    await browserInstance.close();
  }
  process.exit();
});

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

function prepareResponse(reply, response, html = null) {
  try {
    debugLog('Preparing response');
    const status = response.status();
    debugLog(`original status: <${status}>`);
    const headers = response.headers();

    // Problematic headers that should be skipped
    const skipHeaders = new Set([
      'set-cookie',
      'transfer-encoding',
      'connection',
      'keep-alive',
      'upgrade',
      'proxy-authenticate',
      'proxy-authorization'
    ]);

    Object.entries(headers).forEach(([key, value]) => {
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
    });

    // debugLog(`Setting status: <${status}>`);
    // debugLog(`Setting headers: <${JSON.stringify(headers)}>`);

    // For redirects and errors, send only status and headers
    if (!html) {
      debugLog(`For redirects and errors, sending status and headers only, status: <${status}>`);
      return reply.code(status).send('');
    }

    // For successful responses, include the HTML
    debugLog(`For successful responses, including HTML, status: <${status}>`);
    return reply.code(status).send(html);
  } catch (error) {
    debugLog(`Error preparing response: ${error.message}`);
    throw error;
  }
}

// Initialize browserInstance on startup
getBrowser().catch(error => {
  console.error('Failed to initialize browser:', error);
  process.exit(1);
});

const isValidUrl = function (url) {
  try {
    new URL(url.trim()); // This will throw if URL is invalid
    return url.startsWith('http://') || url.startsWith('https://');
  } catch {
    return false;
  }
}



// Block unsafe URLs, private IPs, and invalid URLs
const blockUnsafeUrls = async (url, reply) => {
  try {
    // URL validation
    if (!url) {
      reply.code(400).send({ error: 'URL parameter is required' });
      return true;
    }

    if (!isValidUrl(url)) {
      reply.code(400).send({ error: 'Invalid URL format. Must be a valid HTTP/HTTPS URL' });
      return null;
    }

    const parsedUrl = new URL(url);
    const hostname = parsedUrl.hostname;
    //check further
    //TODO: check if the hostname is a private IP
  } catch (error) {
    reply.code(400).send({ error: 'Invalid URL format' });
    return null;
  }

  //trim url
  url = url.trim();

  return url;
}

fastify.get('/*', async (request, reply) => {
  const targetUrl = `${request.url}`;
  debugLog(`Received request for URL: ${targetUrl}`);
  let url = targetUrl;

  if (targetUrl === '/ok') {
    return reply.code(200).send('ok');
  }

  url = await blockUnsafeUrls(url, reply);
  if (!url) {
    debugLog('URL blocked by safety checks');
    return;
  }

  let page;
  try {
    const currentBrowser = await getBrowser();
    page = await currentBrowser.newPage();
    debugLog('New page created');

    let redirectResponse = null;
    let isRedirected = false;

    await page.setRequestInterception(true);
    page.on('request', request => {
      const resourceType = request.resourceType();
      // debugLog(`Resource request: ${resourceType} - ${request.url()}`);
      // if we already have a redirect response, abort all the request
      if (isRedirected) {
        request.abort();
        return;
      }

      if (request.isNavigationRequest() && request.redirectChain().length > 0) {
        debugLog(`Redirect detected: ${request.url()}, aborting...`);
        isRedirected = true;
        request.abort();
        return;
      }

      if (BLOCKED_RESOURCES.has(resourceType)) {
        // debugLog(`Blocked resource: ${resourceType} - ${request.url()}`);
        request.abort();
        return;
      }

      request.continue();
    });

    page.on('response', response => {
      if (response.url() === url && response.status() >= 300 && response.status() < 400) {
        // its a redirect
        redirectResponse = response;
        isRedirected = true;
      }
    });

    // Set request headers
    // debugLog(`Request headers: ${JSON.stringify(request.headers)}`);
    // // Generates ERROR
    // await page.setExtraHTTPHeaders(request.headers);

    // Navigate with timeout
    const response = await page.goto(url, {
      waitUntil: ['networkidle2', 'domcontentloaded', 'load'],
      timeout: PAGE_TIMEOUT_MS
    }).catch(error => {
      if (isRedirected && redirectResponse) {
        debugLog('Returning initial response for redirect');
        return redirectResponse;
      } else {
        debugLog(`Navigation error: ${error.message}`);
        throw error;
      }
    });

    debugLog(`Page loaded with status: ${response.status()}`);

    // For redirects, send response without HTML
    if (redirectResponse) {
      debugLog('Redirect detected');
      return prepareResponse(reply, redirectResponse);
    }

    // For successful responses, include rendered HTML
    debugLog('No redirect detected, sending HTML');
    const html = await page.content();
    return prepareResponse(reply, response, html);

  } catch (error) {
    debugLog(`Error processing request: ${error.message}`);
    if (error.name === 'TimeoutError') {
      return reply.code(504).send({ error: 'Gateway Timeout' });
    }
    return reply.code(500).send({ error: error.message });
  } finally {
    debugLog('Closing page');
    if (page) {
      await page.close();
      debugLog('Page closed');
    }
    debugLog('Request processed successfully');
    debugLog('--------------------------------');
  }
});



fastify.listen({ port: 3000, host: '0.0.0.0' }, (err) => {
  if (err) {
    console.error(err);
    fastify.log.error(err);
    process.exit(1);
  }
  console.log('Server running on port 3000');
});
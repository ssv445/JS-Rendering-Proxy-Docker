const fastify = require('fastify')();
const puppeteer = require('puppeteer');
const { URL } = require('url');

// Resource types to block
const BLOCKED_RESOURCES = new Set(['image', 'media', 'font']);

// Browser management
let browserInstance = null;
let requestCount = 0;
const PAGE_LIMIT_PER_BROWSER_INSTANCE = 30;
const PAGE_TIMEOUT_MS = 30000;

// Add debug flag
const DEBUG = process.env.DEBUG === 'true';

// Add debug logging function
function debugLog(...args) {
  if (DEBUG) {
    console.log('[DEBUG]', ...args);
  }
}

async function getBrowser() {
  if (!browserInstance || requestCount >= PAGE_LIMIT_PER_BROWSER_INSTANCE) {
    debugLog(`Creating new browser instance. Previous count: ${requestCount}`);
    if (browserInstance) {
      await browserInstance.close();
    }
    browserInstance = await puppeteer.launch({
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


function prepareResponse(reply, response, html = null) {
  const status = response.status();
  const headers = response.headers();

  // Set response headers, excluding ones that shouldn't be proxied
  Object.entries(headers).forEach(([key, value]) => {
    if (!['set-cookie', 'transfer-encoding'].includes(key.toLowerCase())) {
      reply.header(key, value);
    }
  });

  // For redirects and errors, send only status and headers
  if (status >= 300 && status < 400 || !html) {
    return reply.code(status).headers(headers).send();
  }

  // For successful responses, include the HTML
  return reply.code(status).send({
    status,
    headers,
    html
  });
}

// Initialize browserInstance on startup
getBrowser().catch(error => {
  console.error('Failed to initialize browser:', error);
  process.exit(1);
});

const isValidUrl = function(url) {
  return url.startsWith('http://') || url.startsWith('https://');
}

// Block unsafe URLs, private IPs, and invalid URLs
const blockUnsafeUrls = async (url, reply) => {
  // URL validation
  if (!url || !isValidUrl(url)) {
    reply.code(400).send({ error: 'Invalid URL provided' });
    return true;
  }
  
  // // SSRF protection
  // try {
    //   const parsedUrl = new URL(url);
    //   const hostname = parsedUrl.hostname;
    //   if (await isPrivateIP(hostname)) {
      //     return reply.code(403).send({ error: 'Access to internal URLs is forbidden' });
      //   }
      // } catch (error) {
  //   return reply.code(400).send({ error: 'Invalid URL format' });
  // }
  return false;
}

fastify.get('/render', async (request, reply) => {
  const url = request.query.url;
  debugLog(`Received request for URL: ${url}`);

  if(await blockUnsafeUrls(url, reply)) {
    debugLog('URL blocked by safety checks');
    return;
  }

  let page;
  try {
    const currentBrowser = await getBrowser();
    page = await currentBrowser.newPage();
    debugLog('New page created');
    
    let initialResponse = null;
    let isRedirected = false;

    await page.setRequestInterception(true);
    page.on('request', request => {
      const resourceType = request.resourceType();
      debugLog(`Resource request: ${resourceType} - ${request.url()}`);
      
      if (request.isNavigationRequest() && request.redirectChain().length > 0) {
        debugLog(`Redirect detected: ${request.url()}`);
        isRedirected = true;
        request.abort();
        return;
      }

      if (BLOCKED_RESOURCES.has(resourceType)) {
        debugLog(`Blocked resource: ${resourceType} - ${request.url()}`);
        request.abort();
      } else {
        request.continue();
      }
    });

    page.on('response', response => {
      if (response.url() === url) {
        initialResponse = response;
      }
    });

    // Set request headers
    await page.setExtraHTTPHeaders(request.headers);

    // Navigate with timeout
    const response = await page.goto(url, {
      waitUntil: ['networkidle2', 'domcontentloaded', 'load'],
      timeout: PAGE_TIMEOUT_MS
    }).catch(error => {
      debugLog(`Navigation error: ${error.message}`);
      if (isRedirected && initialResponse) {
        debugLog('Returning initial response for redirect');
        return initialResponse;
      }
      throw error;
    });

    debugLog(`Page loaded with status: ${response.status()}`);

    // For redirects, send response without HTML
    if (isRedirected || response.status() >= 300 && response.status() < 400) {
      return prepareResponse(reply, response);
    }

    // For successful responses, include rendered HTML
    const html = await page.content();
    return prepareResponse(reply, response, html);

  } catch (error) {
    debugLog(`Error processing request: ${error.message}`);
    if (error.name === 'TimeoutError') {
      return reply.code(504).send({ error: 'Gateway Timeout' });
    }
    return reply.code(500).send({ error: error.message });
  } finally {
    if (page) {
      await page.close();
      debugLog('Page closed');
    }
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
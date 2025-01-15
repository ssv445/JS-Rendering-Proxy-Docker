const fastify = require('fastify')();
const puppeteer = require('puppeteer');
const isValidUrl = require('is-valid-http-url');
const isPrivateIP = require('is-private-ip');
const { URL } = require('url');

// Resource types to block
const BLOCKED_RESOURCES = new Set(['image', 'media', 'font']);

// Browser management
let browserInstance = null;
let requestCount = 0;
const REQUEST_LIMIT = 30;

async function getBrowser() {
  if (!browserInstance || requestCount >= REQUEST_LIMIT) {
    if (browserInstance) {
      await browserInstance.close();
    }
    browserInstance = await puppeteer.launch({
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    requestCount = 0;
  }
  requestCount++;
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

fastify.get('/render', async (request, reply) => {
  const url = request.query.url;
  
  // URL validation
  if (!url || !isValidUrl(url)) {
    return reply.code(400).send({ error: 'Invalid URL provided' });
  }

  // SSRF protection
  try {
    const parsedUrl = new URL(url);
    const hostname = parsedUrl.hostname;
    if (await isPrivateIP(hostname)) {
      return reply.code(403).send({ error: 'Access to internal URLs is forbidden' });
    }
  } catch (error) {
    return reply.code(400).send({ error: 'Invalid URL format' });
  }

  let page;
  try {
    const currentBrowser = await getBrowser();
    page = await currentBrowser.newPage();
    
    // Track initial request
    let initialResponse = null;
    let isRedirected = false;

    // Block unwanted resources and handle redirects
    await page.setRequestInterception(true);
    page.on('request', request => {
      if (request.isNavigationRequest() && request.redirectChain().length > 0) {
        // This is a redirect, capture it and abort
        isRedirected = true;
        request.abort();
        return;
      }

      if (BLOCKED_RESOURCES.has(request.resourceType())) {
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
      timeout: 30000 // 30 second timeout
    }).catch(error => {
      // If we aborted due to redirect, return the initial response
      if (isRedirected && initialResponse) {
        return initialResponse;
      }
      throw error;
    });

    // For redirects, send response without HTML
    if (isRedirected || response.status() >= 300 && response.status() < 400) {
      return prepareResponse(reply, response);
    }

    // For successful responses, include rendered HTML
    const html = await page.content();
    return prepareResponse(reply, response, html);

  } catch (error) {
    if (error.name === 'TimeoutError') {
      return reply.code(504).send({ error: 'Gateway Timeout' });
    }
    return reply.code(500).send({ error: error.message });
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
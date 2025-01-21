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
const PAGE_LIMIT_PER_BROWSER_INSTANCE = 50;
const PAGE_TIMEOUT_MS = 20000;



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

fastify.get('/*', async (request, reply) => {
  const targetUrl = `${request.url}`;
  let url = targetUrl;

  if (targetUrl === '/ok') {
    return reply.code(200).send('ok');
  }

  try {
    url = await blockUnsafeUrls(url, reply);
  } catch (error) {
    debugLog('URL blocked by safety checks');
    return reply.code(error.status).send({ error: error.message });
  }

  const browserInstance = await puppeteer.launch({
    headless: 'new', // or true/false depending on your Puppeteer version
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--ignore-certificate-errors',
      '--ignore-certificate-errors-spki-list',
      '--disable-web-security'
    ],
    ignoreHTTPSErrors: true
  });

  let page;
  try {
    page = await browserInstance.newPage();
    // debugLog('New page created');
    if (!page) {
      debugLog('New page not created');
      return reply.code(500).send({ error: 'Failed to create page' });
    }

    let redirectResponse = null;
    let isRedirected = false;

    await page.setRequestInterception(true);
    page.on('request', request => {
      const resourceType = request.resourceType();
      // debugLog(`Resource request: ${resourceType} - ${request.url()}`);
      // if we already have a redirect response, abort all the request
      if (isRedirected) {
        request.abort();
      } else if (request.isNavigationRequest() && request.redirectChain().length > 0) {
        debugLog(`Redirect detected: ${request.url()}, aborting...`);
        isRedirected = true;
        request.abort();
      } else if (BLOCKED_RESOURCES.has(resourceType)) {
        // debugLog(`Blocked resource: ${resourceType} - ${request.url()}`);
        request.abort();
      } else {
        request.continue();
      }
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
      waitUntil: ['networkidle2'],
      timeout: PAGE_TIMEOUT_MS
    }).catch(error => {
      if (isRedirected && redirectResponse) {
        debugLog('Returning initial response for redirect');
        return redirectResponse;
      }
      debugLog(`Navigation error: ${error.message}`);
      throw error;
    });

    debugLog(`Page ${url} loaded with status: ${response.status()}`);

    // For redirects, send response without HTML
    if (redirectResponse) {
      await prepareHeader(reply, redirectResponse);
      debugLog('Redirect detected, sending without HTML');
      return reply.code(response.status()).send();
    }

    // For successful responses, include rendered HTML
    const html = await page.content();
    await prepareHeader(reply, response);
    debugLog(`No redirect detected, sending HTML for ${url}: size: ${html.length}`);
    reply.header('Content-Encoding', 'identity');
    reply.header('Content-Type', 'text/html; charset=utf-8');
    return reply.code(response.status()).send(html);

  } catch (error) {
    debugLog(`Error processing request: ${error.message}`);
    if (error.name === 'TimeoutError') {
      debugLog(`TimeoutError for ${url}`);
      return reply.code(504).send({ error: 'Gateway Timeout' });
    } else {
      debugLog(`Error processing request: ${error.name}`);
      return reply.code(500).send({ error: error.message });
    }
  } finally {
    if (page) {
      await page.close();
    }

    //close browser instance
    if (browserInstance) {
      await browserInstance.close();
    }
    debugLog(`Request processing completed for ${url}`);
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


fastify.addHook('onRequest', (request, reply, done) => {
  debugLog(`>>> Request started for ${request.url}`);
  done();
});

fastify.addHook('onResponse', (request, reply, done) => {
  const timeTaken = reply.elapsedTime / 1000;
  debugLog(`<<<< Response Sent for ${request.url} in ${timeTaken} seconds`);
  done();
});

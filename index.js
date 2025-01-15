const fastify = require('fastify')();
const puppeteer = require('puppeteer');
const isValidUrl = require('is-valid-http-url');
const isPrivateIP = require('is-private-ip');
const { URL } = require('url');

// Resource types to block
const BLOCKED_RESOURCES = new Set(['image', 'media', 'font']);

// Browser management
let browser = null;
let requestCount = 0;
const REQUEST_LIMIT = 30;

async function getBrowser() {
  if (!browser || requestCount >= REQUEST_LIMIT) {
    if (browser) {
      await browser.close();
    }
    browser = await puppeteer.launch({
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    requestCount = 0;
  }
  requestCount++;
  return browser;
}

// Initialize browser on startup
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
    
    // Block unwanted resources
    await page.setRequestInterception(true);
    page.on('request', request => {
      if (BLOCKED_RESOURCES.has(request.resourceType())) {
        request.abort();
      } else {
        request.continue();
      }
    });

    // Set request headers
    await page.setExtraHTTPHeaders(request.headers);

    // Navigate with timeout
    const response = await page.goto(url, {
      waitUntil: ['networkidle2', 'domcontentloaded', 'load'],
      timeout: 30000 // 30 second timeout
    });

    // Handle redirects
    if (response.status() >= 300 && response.status() < 400) {
      const headers = response.headers();
      return reply
        .code(response.status())
        .headers(headers)
        .send();
    }

    const html = await page.content();
    const responseHeaders = response.headers();

    // Set response headers
    Object.entries(responseHeaders).forEach(([key, value]) => {
      // Skip headers that shouldn't be proxied
      if (!['set-cookie', 'transfer-encoding'].includes(key.toLowerCase())) {
        reply.header(key, value);
      }
    });

    return {
      status: response.status(),
      headers: responseHeaders,
      html
    };

  } catch (error) {
    if (error.name === 'TimeoutError') {
      return reply.code(504).send({ error: 'Gateway Timeout' });
    }
    return reply.code(500).send({ error: error.message });
  }
});

// Cleanup on shutdown
process.on('SIGINT', async () => {
  if (browser) {
    await browser.close();
  }
  process.exit();
});

process.on('SIGTERM', async () => {
  if (browser) {
    await browser.close();
  }
  process.exit();
});

fastify.listen({ port: 3000, host: '0.0.0.0' }, (err) => {
  if (err) {
    console.error(err);
    fastify.log.error(err);
    process.exit(1);
  }
  console.log('Server running on port 3000');
});
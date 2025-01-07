const fastify = require('fastify')({ logger: true });
const puppeteer = require('puppeteer');

fastify.get('/', async (request, reply) => {
  const url = request.query.url;
  if (!url) {
    return reply.status(400).send('Missing ?url=');
  }

  const browser = await puppeteer.launch({
    headless: 'new', // or true/false depending on your Puppeteer version
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle2' });
    const html = await page.content();
    return html;
  } catch (err) {
    console.error(err);
    return reply.status(500).send('Something went wrong');
  } finally {
    await browser.close();
  }
});

fastify.listen({ port: 3000, host: '0.0.0.0' }, (err) => {
  if (err) {
    fastify.log.error(err);
    process.exit(1);
  }
  console.log(`Server running on http://0.0.0.0:3000`);
});
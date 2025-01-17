const fastify = require('fastify')();

// Mock responses for different scenarios
fastify.get('/success', async (request, reply) => {
  return reply
    .code(200)
    .header('Content-Type', 'text/html')
    .send(`
      <html>
        <head><title>Success Page</title></head>
        <body>
          <h1>Success</h1>
          <img src="/blocked.jpg" />
          <video src="/blocked.mp4"></video>
        </body>
      </html>
    `);
});

fastify.get('/redirect', async (request, reply) => {
  return reply
    .code(302)
    .header('Location', 'http://localhost:3001/success')
    .send();
});

fastify.get('/redirect-chain', async (request, reply) => {
  return reply
    .code(301)
    .header('Location', 'http://localhost:3001/redirect')
    .send();
});

fastify.get('/redirect-404', async (request, reply) => {
  return reply
    .code(301)
    .header('Location', 'http://localhost:3001/unknown')
    .send();
});

fastify.get('/slow', async (request, reply) => {
  await new Promise(resolve => setTimeout(resolve, 5000));
  return reply.send('<html><body>Slow response</body></html>');
});

fastify.get('/custom-headers', async (request, reply) => {
  return reply
    .code(200)
    .header('X-Custom-Header', 'test-value')
    .header('Set-Cookie', 'session=123')
    .send('<html><body>Custom headers</body></html>');
});

// 500 error
fastify.get('/500', async (request, reply) => {
  return reply.code(500).send('<html><body>500 error</body></html>');
});

fastify.listen({ port: 3001 }, (err) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  console.log('Mock server running on port 3001');
}); 
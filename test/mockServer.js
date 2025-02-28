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

fastify.get('/block-js', async (request, reply) => {
  console.log('in block-js');
  return reply
    .code(200)
    .header('Content-Type', 'text/html')
    .send(`
    <html>
      <head>
      <script src="http://localhost:3001/super-blocked.js" onload="document.body.innerHTML = 'super-blocked.js'"></script>
        <script src="http://localhost:3001/super-fast.js" onload="document.body.innerHTML = 'super-fast.js'"></script>
        <script src="http://localhost:3001/super-slow.js" onload="document.body.innerHTML = 'super-slow.js'"></script>
        <link rel="stylesheet" href="http://localhost:3001/super-slow.css">
      </head>
      <body>ORIGINAL BODY</body>
    </html>
  `);
});

fastify.get('/js-execution', async (request, reply) => {
  console.log('in js-execution');
  return reply
    .code(200)
    .header('Content-Type', 'text/html')
    .send(`
    <html>
      <head>
        <script>
          document.body.innerHTML = 'JSExecutionTest';
        </script>
      </head>
      <body>
      </body>
    </html>
  `);
});

//super fast js
fastify.get('/super-fast.js', async (request, reply) => {
  console.log('in super-fast.js');
  //js should append BlockJSTest to the body
  //flag content as javascript
  reply.header('Content-Type', 'application/javascript');
  const js = `
    document.body.innerHTML = 'SuperFastJSExecuted';
    console.log('SuperFastJSExecuted');
  `;
  return reply.send(js);
});

fastify.get('/super-slow.js', async (request, reply) => {
  console.log('in super-slow.js');
  await new Promise(resolve => setTimeout(resolve, 10000));
  //js should append BlockJSTest to the body
  const js = `
    console.log('SuperSlowJSExecuted'); 
  `;
  reply.header('Content-Type', 'application/javascript');
  return reply.send(js);
});

fastify.get('/super-blocked.js', async (request, reply) => {
  console.log('in super-blocked.js');
  await new Promise(resolve => setTimeout(resolve, 10000));
  //js should append BlockJSTest to the body
  const js = `
    console.log('SuperBlockedJSExecuted'); 
    document.body.innerHTML = 'BlockJSTest';
  `;
  reply.header('Content-Type', 'application/javascript');
  return reply.send(js);
});

fastify.get('/super-slow.css', async (request, reply) => {
  console.log('in super-slow.css');
  await new Promise(resolve => setTimeout(resolve, 10000));
  const css = `
    body {
      background-color: red;
    }
  `;
  reply.header('Content-Type', 'text/css');
  return reply.send(css);
});

fastify.listen({ port: 3001 }, (err) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  console.log('Mock server running on port 3001');
}); 
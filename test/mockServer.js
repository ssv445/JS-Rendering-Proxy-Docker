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

// Method 3: Destroy connection
fastify.get('/no-response-destroy', async (request, reply) => {
  reply.raw.socket?.destroy();
  return;
});

fastify.get('/no-response', async (request, reply) => {
  reply.code(204).send();
  // Puppeteer's page.goto() might return null for 204 responses
});

//ERR_CONNECTION_CLOSED
fastify.get('/no-response-connection-closed', async (request, reply) => {
  // --- Introduce a small delay ---
  // Wait for 100 milliseconds. This might be enough for the browser
  // to fully establish the connection state before it's torn down.
  await new Promise(resolve => setTimeout(resolve, 100)); // 100ms delay
  // --- End of delay ---

  try {
    // Access the underlying Node.js socket object
    const socket = reply.raw.socket;
    // Start sending response
    reply.raw.writeHead(200);
    reply.raw.write('partial data');
    if (socket && !socket.destroyed) {
      // Destroy the socket after the delay
      socket.destroy();
      console.log('Socket destroyed successfully after delay.');
    } else {
      console.warn('Socket not found or already destroyed before delayed destruction attempt.');
    }
  } catch (error) {
    console.error('Error while trying to destroy socket after delay:', error);
  }

  return;
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
  const seconds = parseInt(request.query.seconds) || 10;
  console.log('in super-slow.css');
  await new Promise(resolve => setTimeout(resolve, seconds * 1000));
  const css = `
    body {
      background-color: red;
    }
  `;
  reply.header('Content-Type', 'text/css');
  return reply.send(css);
});

fastify.get('/fast-page-slow-resource', async (request, reply) => {
  console.log('in fast-page-slow-resource');
  return reply
    .code(200)
    .header('Content-Type', 'text/html')
    .send(`
    <html>
      <head>
      </head>
      <body>
      ORIGINAL BODY: fast-page-slow-resource
      <script src='http://localhost:3001/super-slow.js?seconds=2' onload="document.body.innerHTML = 'super-slow.js'"></script>
      <script src='http://localhost:3001/super-slow.js?seconds=2' onload="document.body.innerHTML = 'super-slow.js'"></script>
      </body>
    </html>
  `);
});

fastify.get('/fast-page-slow-resource-headscripts', async (request, reply) => {
  console.log('in fast-page-slow-resource-headscripts');
  return reply
    .code(200)
    .header('Content-Type', 'text/html')
    .send(`
    <html>
      <head>
        <script src='http://localhost:3001/super-slow.js?seconds=2' onload="document.body.innerHTML = 'super-slow.js'"></script>
      <script src='http://localhost:3001/super-slow.js?seconds=2' onload="document.body.innerHTML = 'super-slow.js'"></script>
      </head>
      <body>
      ORIGINAL BODY: fast-page-slow-resource-headscripts
      </body>
    </html>
  `);
});

//create a webpage, which uses JS to create heavy CPU load for 10 seconds
//also include a super slow resource
fastify.get('/heavy-cpu', async (request, reply) => {
  const seconds = parseInt(request.query.seconds) || 10;
  return reply
    .code(200)
    .header('Content-Type', 'text/html')
    .send(`
    <html>
      <head>
        <script>
          function createHeavyCpu() {
            const startTime = Date.now();
            let i = 0;
            while (Date.now() - startTime < ${seconds * 1000}) {
              i++;
                Math.pow(i, 2)
  Math.sqrt(i)
  Math.sin(i)
  i++;
              //do nothing
            }
          }
          createHeavyCpu();
        </script>
      </head>
      <body>
        HEAVY CPU PAGE
        <script src="http://localhost:3001/super-slow.js" onload="document.body.innerHTML = 'super-slow.js'"></script>
      </body>
    </html>
  `);
});

// webpage which uses JS to create heavy memory load of 100MB
fastify.get('/heavy-memory', async (request, reply) => {
  const memoryInMB = parseInt(request.query.memoryInMB) || 100;
  const parentArraySize = 1024 * 1024;//1MB
  const childArraySize = Math.floor(memoryInMB);
  return reply
    .code(200)
    .header('Content-Type', 'text/html')
    .send(`
      <html>
        <head>
          <script>
            function createHeavyMemory() {
              const array = new Array(${parentArraySize});
              for (let i = 0; i < array.length; i++) {
                array[i] = new Array(${childArraySize});  
              }
            }
            createHeavyMemory();
          </script>
          <script src="http://localhost:3001/super-slow.js" onload="document.body.innerHTML = 'super-slow.js'"></script>
        </head>
        <body>
          HEAVY MEMORY PAGE
        </body>
      </html>
    `);
});

fastify.listen({ port: 3001 }, (err) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  console.log('Mock server running on port 3001');
}); 
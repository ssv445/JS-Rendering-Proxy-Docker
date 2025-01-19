const axios = require('axios');
const assert = require('assert');

const PROXY_URL = 'http://localhost:3000/render';
const TEST_TIMEOUT = 35000;

// Configure axios to use proxy
const axiosProxyInstance = axios.create({
  proxy: {
    host: 'localhost',
    port: 3000,
    protocol: 'http',
  },
  // Still don't throw on non-200
  validateStatus: () => true,
  maxRedirects: 0,
  timeout: 60000,
  // ignore certificate errors
  httpsAgent: new require('https').Agent({
    rejectUnauthorized: false
  }),
});

const axiosInstance = axios.create({
  validateStatus: () => true,
  maxRedirects: 0
});

async function printResponse(response) {
  console.log('Response:  : ', { data: response.data, status: response.status, location: response.headers.location });
}

async function testSuccessfulRender() {
  console.log('\nTesting successful render...');
  const response = await axiosProxyInstance.get('http://localhost:3001/success');
  assert.strictEqual(response.status, 200);
  assert(response.data.includes('<h1>Success</h1>'));
  console.log('✅ Success test passed');
}

async function test404() {
  console.log('\nTesting 404...');
  const response = await axiosProxyInstance.get('http://localhost:3001/unknown');
  // printResponse(response);
  assert.strictEqual(response.status, 404);
  console.log('✅ 404 test passed');
}

async function testRedirectHandling() {
  console.log('\nTesting redirect handling...');
  const response = await axiosProxyInstance.get('http://localhost:3001/redirect');
  // printResponse(response);
  assert.strictEqual(response.status, 302);
  assert(response.headers.location);
  console.log('✅ Redirect test passed');
}

async function testRedirectChain() {
  console.log('\nTesting redirect chain...');
  const response = await axiosProxyInstance.get('http://localhost:3001/redirect-chain');
  // printResponse(response);
  assert.strictEqual(response.status, 301);
  console.log('✅ Redirect chain test passed');
}

async function testRedirect404() {
  console.log('\nTesting redirect 404...');
  const response = await axiosProxyInstance.get('http://localhost:3001/redirect-404');
  // printResponse(response);
  assert.strictEqual(response.status, 301);
  console.log('✅ Redirect 404 test passed');
}

async function test500() {
  console.log('\nTesting 500...');
  const response = await axiosProxyInstance.get('http://localhost:3001/500');
  // printResponse(response);
  assert.strictEqual(response.status, 500);
  console.log('✅ 500 test passed');
}

async function testCustomHeaders() {
  console.log('\nTesting custom headers...');
  const headersResponse = await axiosProxyInstance.get('http://localhost:3001/custom-headers');
  assert.strictEqual(headersResponse.headers['x-custom-header'], 'test-value');
  assert(!headersResponse.headers['set-cookie']); // Should be stripped
  console.log('✅ Custom headers test passed');
}

async function testSlowResponse() {
  console.log('\nTesting slow response...');
  const response = await axiosProxyInstance.get('http://localhost:3001/slow');
  // printResponse(response);
  assert.strictEqual(response.status, 200);
  console.log('✅ Slow response test passed');
}

async function testInvalidURL() {
  console.log('\nTesting invalid URL...');
  try {
    const response = await axiosProxyInstance.get(`invalid-url`);
    printResponse(response);
    assert.strictEqual(response.status, 400);

    console.log('✅ Invalid URL test passed');
  } catch (error) {
    console.log('[x] Failed to test invalid URL');
  }
}

async function testPrivateIPBlocking() {
  console.log('\nTesting private IP blocking...');
  try {
    await axiosProxyInstance.get(`http://192.168.1.1`);
    assert.fail('Should have thrown an error');
    console.log('✅ Private IP blocking test passed');
  } catch (error) {
    console.log('[x] Failed to block private IP');
  }
}

async function testRandomWebsite() {
  let websites = require('./websiteList');

  console.log('\nTesting random websites...');

  for (let i = 0; i < websites.length; i++) {
    let randomWebsite = websites[i];
    try {
      console.log(`Website: [${i + 1}]`, randomWebsite);
      const { status } = await axiosProxyInstance.get(randomWebsite);
      console.log('Status: ', status);
    } catch (error) {
      console.log(`Website: [${i + 1}] ${randomWebsite} Error: `, error);
      throw error;
    }
  }
  console.log('✅ Random website test passed');
}

async function runTests() {


  // check if the mock server is accepting requests
  const mockServerResponse = await axiosInstance.get('http://localhost:3001/success');
  if (mockServerResponse.status !== 200) {
    console.error('Mock server is not accepting requests');
    process.exit(1);
  }

  // check if the proxy server is accepting requests
  const proxyServerResponse = await axiosInstance.get('http://localhost:3000/ok');
  if (proxyServerResponse.status !== 200) {
    console.error('Proxy server is not accepting requests');
    process.exit(1);
  }

  try {
    await testRandomWebsite();

    await testSuccessfulRender();
    await testRedirectChain();
    await testRedirectHandling();
    await test404();
    await testRedirect404();
    await test500();
    await testCustomHeaders();


    await testInvalidURL();
    await testSlowResponse();




    // await testPrivateIPBlocking();

    console.log('\n🎉 All tests passed!');
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    if (error.response) {
      console.error('Response:', {
        status: error.response.status,
        headers: error.response.headers,
        data: error.response.data
      });
    }
    process.exit(1);
  }
}

// Run tests
console.log('Starting tests...');
console.log('Make sure both proxy server and mock server are running');


runTests();




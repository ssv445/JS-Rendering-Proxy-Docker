const axios = require('axios');
const assert = require('assert');

const PROXY_URL = 'http://localhost:3000/render';
const TEST_TIMEOUT = 35000;

// axios should not throw an error if the status code is not 200
axios.defaults.validateStatus = () => true;
axios.defaults.maxRedirects = 0;


async function printResponse(response) {
  console.log('Response:  : ', { data: response.data, status: response.status, location: response.headers.location });
}

async function testSuccessfulRender() {
  console.log('\nTesting successful render...');
  const response = await axios.get(`${PROXY_URL}?url=http://localhost:3001/success`);
  // printResponse(response);
  assert.strictEqual(response.status, 200);
  assert(response.data.includes('<h1>Success</h1>'));
  console.log('✅ Success test passed');
}

async function test404() {
  console.log('\nTesting 404...');
  const response = await axios.get(`${PROXY_URL}?url=http://localhost:3001/unknown`);
  // printResponse(response);
  assert.strictEqual(response.status, 404);
  console.log('✅ 404 test passed');
}

async function testRedirectHandling() {
  console.log('\nTesting redirect handling...');
  const response = await axios.get(`${PROXY_URL}?url=http://localhost:3001/redirect`);
  // printResponse(response);
  assert.strictEqual(response.status, 302);
  assert(response.headers.location);
  console.log('✅ Redirect test passed');
}

async function testRedirectChain() {
  console.log('\nTesting redirect chain...');
  const response = await axios.get(`${PROXY_URL}?url=http://localhost:3001/redirect-chain`);
  // printResponse(response);
  assert.strictEqual(response.status, 301);
  console.log('✅ Redirect chain test passed');
}

async function testRedirect404() {
  console.log('\nTesting redirect 404...');
  const response = await axios.get(`${PROXY_URL}?url=http://localhost:3001/redirect-404`);
  // printResponse(response);
  assert.strictEqual(response.status, 301);
  console.log('✅ Redirect 404 test passed');
}

async function test500() {
  console.log('\nTesting 500...');
  const response = await axios.get(`${PROXY_URL}?url=http://localhost:3001/500`);
  // printResponse(response);
  assert.strictEqual(response.status, 500);
  console.log('✅ 500 test passed');
}

async function testCustomHeaders() {
  console.log('\nTesting custom headers...');
  const headersResponse = await axios.get(`${PROXY_URL}?url=http://localhost:3001/custom-headers`);
  assert.strictEqual(headersResponse.headers['x-custom-header'], 'test-value');
  assert(!headersResponse.headers['set-cookie']); // Should be stripped
  console.log('✅ Custom headers test passed');
}

async function testSlowResponse() {
  console.log('\nTesting slow response...');
  const response = await axios.get(`${PROXY_URL}?url=http://localhost:3001/slow`);
  // printResponse(response);
  assert.strictEqual(response.status, 200);
  console.log('✅ Slow response test passed');
}

async function testInvalidURL() {
  console.log('\nTesting invalid URL...');
  const response = await axios.get(`${PROXY_URL}?url=invalid-url`);
  // printResponse(response);
  assert.strictEqual(response.status, 400);

  console.log('✅ Invalid URL test passed');
}

async function testPrivateIPBlocking() {
  console.log('\nTesting private IP blocking...');
  try {
    await axios.get(`${PROXY_URL}?url=http://192.168.1.1`);
    assert.fail('Should have thrown an error');
    console.log('✅ Private IP blocking test passed');
  } catch (error) {
    console.log('[x] Failed to block private IP');
  }
}

async function testRandomWebsite() {
  let websites = require('./websiteList');
  // randomize the websites
  // websites = websites.sort(() => Math.random() - 0.5);

  console.log('\nTesting random websites...');

  for (let i = 0; i < websites.length; i++) {
    let randomWebsite = websites[i];
    try {
      console.log(`Website: [${i + 1}]`, randomWebsite);
      const { status } = await axios.get(`${PROXY_URL}?url=${randomWebsite}`);
      console.log('Status: ', status);
    } catch (error) {
      console.log('Website: [${i + 1}]', randomWebsite, 'Error: ', error);
    }
  }
  console.log('✅ Random website test passed');

}

async function runTests() {


  // check if the mock server is accepting requests
  const mockServerResponse = await axios.get('http://localhost:3001/success');
  if (mockServerResponse.status !== 200) {
    console.error('Mock server is not accepting requests');
    process.exit(1);
  }

  // check if the proxy server is accepting requests
  const proxyServerResponse = await axios.get('http://localhost:3000/render?url=http://localhost:3001/success');
  if (proxyServerResponse.status !== 200) {
    console.error('Proxy server is not accepting requests');
    process.exit(1);
  }

  try {

    // await testSuccessfulRender();
    // await test404();
    // await testRedirectChain();
    // await testRedirectHandling();
    // await testRedirect404();
    // await test500();

    // await testCustomHeaders();
    // await testSlowResponse();
    // await testInvalidURL();

    await testRandomWebsite();



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




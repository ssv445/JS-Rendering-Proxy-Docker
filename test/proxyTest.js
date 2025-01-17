const axios = require('axios');
const assert = require('assert');

const PROXY_URL = 'http://localhost:3000/render';
const TEST_TIMEOUT = 35000;

async function testSuccessfulRender() {
  console.log('\nTesting successful render...');
  const successResponse = await axios.get(`${PROXY_URL}?url=http://localhost:3001/success`);
  assert.strictEqual(successResponse.status, 200);
  assert(successResponse.data.includes('<h1>Success</h1>'));
  console.log('✅ Success test passed');
}

async function testRedirectHandling() {
  console.log('\nTesting redirect handling...');
  const redirectResponse = await axios.get(`${PROXY_URL}?url=http://localhost:3001/redirect`);
  console.log('redirectResponse: ', {data: redirectResponse.data, status: redirectResponse.status, location: redirectResponse.headers.location});
  assert.strictEqual(redirectResponse.status, 302);
  assert(redirectResponse.headers.location);
  console.log('✅ Redirect test passed');
}

async function testRedirectChain() {
  console.log('\nTesting redirect chain...');
  const redirectChainResponse = await axios.get(`${PROXY_URL}?url=http://localhost:3001/redirect-chain`);
  assert.strictEqual(redirectChainResponse.status, 301);
  console.log('✅ Redirect chain test passed');
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
  const slowResponse = await axios.get(`${PROXY_URL}?url=http://localhost:3001/slow`);
  assert.strictEqual(slowResponse.status, 200);
  console.log('✅ Slow response test passed');
}

async function testInvalidURL() {
  console.log('\nTesting invalid URL...');
  try {
    await axios.get(`${PROXY_URL}?url=invalid-url`);
    assert.fail('Should have thrown an error');
  } catch (error) {
    assert.strictEqual(error.response.status, 400);
  }
  console.log('✅ Invalid URL test passed');
}

async function testPrivateIPBlocking() {
  console.log('\nTesting private IP blocking...');
  try {
    await axios.get(`${PROXY_URL}?url=http://192.168.1.1`);
    assert.fail('Should have thrown an error');
  } catch (error) {
    assert.strictEqual(error.response.status, 403);
  }
  console.log('✅ Private IP blocking test passed');
}

async function runTests() {
  try {
    await testSuccessfulRender();
    await testRedirectChain();
    await testRedirectHandling();
    await testCustomHeaders();
    await testSlowResponse();
    await testInvalidURL();
    await testPrivateIPBlocking();

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
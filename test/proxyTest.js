const axios = require('axios');
const assert = require('assert');

const PROXY_URL = 'http://localhost:3000/render';
const TEST_TIMEOUT = 35000;

async function runTests() {
  try {
    // Test 1: Successful render
    // console.log('\nTesting successful render...');
    // const successResponse = await axios.get(`${PROXY_URL}?url=http://localhost:3001/success`);
    // assert.strictEqual(successResponse.status, 200);
    // assert(successResponse.data.includes('<h1>Success</h1>'));
    // console.log('✅ Success test passed');

    // Test 2: Redirect handling
    console.log('\nTesting redirect handling...');
    const redirectResponse = await axios.get(`${PROXY_URL}?url=http://localhost:3001/redirect`);
    console.log('redirectResponse: ', {data: redirectResponse.data, status: redirectResponse.status, location: redirectResponse.headers.location});
    assert.strictEqual(redirectResponse.status, 302);
    assert(redirectResponse.headers.location);
    console.log('✅ Redirect test passed');

    // Test 3: Redirect chain
    console.log('\nTesting redirect chain...');
    const redirectChainResponse = await axios.get(`${PROXY_URL}?url=http://localhost:3001/redirect-chain`);
    assert.strictEqual(redirectChainResponse.status, 301);
    console.log('✅ Redirect chain test passed');

    // Test 4: Custom headers
    console.log('\nTesting custom headers...');
    const headersResponse = await axios.get(`${PROXY_URL}?url=http://localhost:3001/custom-headers`);
    assert.strictEqual(headersResponse.headers['x-custom-header'], 'test-value');
    assert(!headersResponse.headers['set-cookie']); // Should be stripped
    console.log('✅ Custom headers test passed');

    // Test 5: Slow response
    console.log('\nTesting slow response...');
    const slowResponse = await axios.get(`${PROXY_URL}?url=http://localhost:3001/slow`);
    assert.strictEqual(slowResponse.status, 200);
    console.log('✅ Slow response test passed');

    // Test 6: Invalid URL
    console.log('\nTesting invalid URL...');
    try {
      await axios.get(`${PROXY_URL}?url=invalid-url`);
      assert.fail('Should have thrown an error');
    } catch (error) {
      assert.strictEqual(error.response.status, 400);
    }
    console.log('✅ Invalid URL test passed');

    // Test 7: Private IP blocking
    console.log('\nTesting private IP blocking...');
    try {
      await axios.get(`${PROXY_URL}?url=http://192.168.1.1`);
      assert.fail('Should have thrown an error');
    } catch (error) {
      assert.strictEqual(error.response.status, 403);
    }
    console.log('✅ Private IP blocking test passed');

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
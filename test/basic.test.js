const axios = require('axios');

const TEST_TIMEOUT = 30000;

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
    timeout: TEST_TIMEOUT - 2000,
    // add api key to headers
    headers: {
        'x-api-key': '1234567890',
        'x-page-timeout-ms': '10000'
    }
});

const axiosInstance = axios.create({
    validateStatus: () => true,
    maxRedirects: 0,
    timeout: TEST_TIMEOUT - 2000,
    // add api key to headers
    headers: {
        'x-api-key': '1234567890',
        'x-page-timeout-ms': '10000'
    }
});

// Run specific test
// npm run test  -- --testNamePattern="page timeout"

describe('Basic Tests', () => {
    test('server and test server are running', async () => {
        // Check if servers are running
        const mockServerResponse = await axiosInstance.get('http://localhost:3001/success');
        expect(mockServerResponse.status).toBe(200);

        const proxyServerResponse = await axiosInstance.get('http://localhost:3000/ok');
        expect(proxyServerResponse.status).toBe(200);
    });

    test('successful render', async () => {
        const response = await axiosInstance.get('http://localhost:3000/?render_url=' + 'http://localhost:3001/success');
        expect(response.status).toBe(200);
        expect(response.data).toContain('<h1>Success</h1>');
    }, TEST_TIMEOUT);

    test('404 handling', async () => {
        const response = await axiosInstance.get('http://localhost:3000/?render_url=' + 'http://localhost:3001/unknown');
        expect(response.status).toBe(404);
    }, TEST_TIMEOUT);

    test('redirect handling', async () => {
        const response = await axiosInstance.get('http://localhost:3000/?render_url=' + 'http://localhost:3001/redirect');
        expect(response.status).toBe(302);
        expect(response.headers.location).toBe('http://localhost:3001/success');
    }, TEST_TIMEOUT);

    test('redirect chain', async () => {
        const response = await axiosInstance.get('http://localhost:3000/?render_url=' + 'http://localhost:3001/redirect-chain');
        expect(response.status).toBe(301);
        expect(response.headers.location).toBe('http://localhost:3001/redirect');
    }, TEST_TIMEOUT);

    test('redirect 404', async () => {
        const response = await axiosInstance.get('http://localhost:3000/?render_url=' + 'http://localhost:3001/redirect-404');
        expect(response.status).toBe(301);
    }, TEST_TIMEOUT);

    test('page with status 500', async () => {
        const response = await axiosInstance.get('http://localhost:3000/?render_url=' + 'http://localhost:3001/500');
        expect(response.status).toBe(500);
    }, TEST_TIMEOUT);

    test('custom headers', async () => {
        const response = await axiosInstance.get('http://localhost:3000/?render_url=' + 'http://localhost:3001/custom-headers');
        expect(response.status).toBe(200);
        expect(response.headers['x-custom-header']).toBe('test-value');
    }, TEST_TIMEOUT);

    test('slow response', async () => {
        const response = await axiosInstance.get('http://localhost:3000/?render_url=' + 'http://localhost:3001/slow');
        expect(response.status).toBe(200);
    }, TEST_TIMEOUT);

    test('invalid url', async () => {
        const response = await axiosInstance.get('http://localhost:3000/?render_url=' + 'http://localhost:3001/invalid-url');
        expect(response.status).toBe(404);
    }, TEST_TIMEOUT);

    test('js execution', async () => {
        const response = await axiosInstance.get('http://localhost:3000/?render_url=' + 'http://localhost:3001/js-execution', {
            headers: {
                'x-wait-until-condition': 'networkidle0',
            }
        });
        expect(response.status).toBe(200);
        expect(response.data).toContain('JSExecutionTest');
    }, TEST_TIMEOUT);

    test('block js', async () => {
        //add header to wait for networkidle0
        const response = await axiosInstance.get('http://localhost:3000/?render_url=' + 'http://localhost:3001/block-js', {
            headers: {
                'x-wait-until-condition': 'domcontentloaded',
                'x-block-js': 'super-blocked.js',
                'x-page-timeout-ms': '20000',
            }
        });
        expect(response.status).toBe(200);
        //response body should contain BlockJSTest
        expect(response.data).toContain('BlockJSTest');
    }, TEST_TIMEOUT);


    // a testcase which check if page timesout still get the partial content
    test('page timeout partial content', async () => {
        const response = await axiosInstance.get('http://localhost:3000/?render_url=' + 'http://localhost:3001/fast-page-slow-resource', {
            headers: {
                'x-page-timeout-ms': '1000'
            }
        });
        expect(response.status).toBe(200);
        expect(response.data).toContain('fast-page-slow-resource');
    }, TEST_TIMEOUT);

    // a testcase which check if page timesout dont have body should be 504
    test('page timeout error into 504', async () => {
        const response = await axiosInstance.get('http://localhost:3000/?render_url=' + 'http://localhost:3001/fast-page-slow-resource-headscripts', {
            headers: {
                'x-page-timeout-ms': '1000'
            }
        });
        expect(response.status).toBe(504);
        // response body should not contain <body
        expect(response.data).not.toContain('<body');
    }, TEST_TIMEOUT);


    //test when more than 10 requests are made at the same time, then server should send 429
    test('multiple requests', async () => {
        const promises = [];
        for (let i = 0; i < 30; i++) {
            promises.push(axiosInstance.get('http://localhost:3000/?render_url=' + 'http://localhost:3001/success'));
        }
        const responses = await Promise.all(promises);
        // some of the responses should be 429
        const fourTwentyNineResponses = responses.filter(response => response.status === 429);
        expect(fourTwentyNineResponses.length).toBeGreaterThan(0);
        expect(fourTwentyNineResponses.length).toBeLessThan(responses.length);
    }, TEST_TIMEOUT);

    //https://www.dietapplements.com/
    test('slow website', async () => {
        const response = await axiosInstance.get('http://localhost:3000/?render_url=' + 'https://www.dietapplements.com/', {
            headers: {
                'x-page-timeout-ms': '10000'
            }
        });
        expect(response.status).toBe(200);
        expect(response.data).toContain('Dietapplements Limited');

    }, TEST_TIMEOUT);

    // must ignore SSL Certificate and Authority errors, and still render the page
    test('ignore ssl certificate errors', async () => {
        const response = await axiosInstance.get('http://localhost:3000/?render_url=' + 'https://chekkee.com', {
            headers: {
                'x-page-timeout-ms': '10000'
            }
        });
        expect(response.status).toBe(200);
        expect(response.data).toContain('<body');
    }, TEST_TIMEOUT);

    const websites403 = [
        'https://www.drainfieldsolutions.com',
        'https://www.w2gositeservices.com/',
        'https://ganknow.com/blog/',
        'https://www.pleasureinjapan.com/blog',
        'https://www.revefi.com/',
        'https://igni7e.com/blog',
    ];
    //should not be 403 error
    websites403.forEach(async (website) => {
        test(`should not be 403 error ${website}`, async () => {
            const axiosProxyResponse = await axiosInstance.get('http://localhost:3000/?render_url=' + website)
            console.log(website, axiosProxyResponse.status);
            expect(axiosProxyResponse.status).not.toBe(403);

        }, TEST_TIMEOUT);
    });

    //test ERR_CONNECTION_CLOSED
    test('ERR_CONNECTION_CLOSED', async () => {
        const response = await axiosInstance.get('http://localhost:3000/?render_url=' + 'https://www.finosauras.com');
        expect(response.status).toBe(502);
    }, TEST_TIMEOUT);

    //test ERR_SSL_PROTOCOL_ERROR
    test('ERR_SSL_PROTOCOL_ERROR', async () => {
        const response = await axiosInstance.get('http://localhost:3000/?render_url=' + 'https://www.moonlink.site');
        expect(response.status).toBe(525);
    }, TEST_TIMEOUT);

    // test NO response received
    // test('NO response received', async () => {
    //     const response = await axiosInstance.get('http://localhost:3000/?render_url=' + 'https://www.drainfieldsolutions.com/');
    //     expect(response.status).toBe(502);
    // }, TEST_TIMEOUT);
});
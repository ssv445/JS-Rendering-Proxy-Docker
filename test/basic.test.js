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
        'x-api-key': '1234567890'
    }
});

const axiosInstance = axios.create({
    validateStatus: () => true,
    maxRedirects: 0,
    timeout: TEST_TIMEOUT - 2000,
});

describe('Basic Tests', () => {
    beforeAll(async () => {
        // Check if servers are running
        const mockServerResponse = await axiosInstance.get('http://localhost:3001/success');
        expect(mockServerResponse.status).toBe(200);

        const proxyServerResponse = await axiosInstance.get('http://localhost:3000/ok');
        expect(proxyServerResponse.status).toBe(200);
    });

    test('successful render', async () => {
        const response = await axiosProxyInstance.get('http://localhost:3001/success');
        expect(response.status).toBe(200);
        expect(response.data).toContain('<h1>Success</h1>');
    }, TEST_TIMEOUT);

    test('404 handling', async () => {
        const response = await axiosProxyInstance.get('http://localhost:3001/unknown');
        expect(response.status).toBe(404);
    }, TEST_TIMEOUT);

    test('redirect handling', async () => {
        const response = await axiosProxyInstance.get('http://localhost:3001/redirect');
        expect(response.status).toBe(302);
        expect(response.headers.location).toBe('http://localhost:3001/success');
    }, TEST_TIMEOUT);

    test('redirect chain', async () => {
        const response = await axiosProxyInstance.get('http://localhost:3001/redirect-chain');
        expect(response.status).toBe(301);
        expect(response.headers.location).toBe('http://localhost:3001/redirect');
    }, TEST_TIMEOUT);

    test('redirect 404', async () => {
        const response = await axiosProxyInstance.get('http://localhost:3001/redirect-404');
        expect(response.status).toBe(301);
    }, TEST_TIMEOUT);

    test('page with status 500', async () => {
        const response = await axiosProxyInstance.get('http://localhost:3001/500');
        expect(response.status).toBe(500);
    }, TEST_TIMEOUT);

    test('custom headers', async () => {
        const response = await axiosProxyInstance.get('http://localhost:3001/custom-headers');
        expect(response.status).toBe(200);
        expect(response.headers['x-custom-header']).toBe('test-value');
    }, TEST_TIMEOUT);

    test('slow response', async () => {
        const response = await axiosProxyInstance.get('http://localhost:3001/slow');
        expect(response.status).toBe(200);
    }, TEST_TIMEOUT);

    test('invalid url', async () => {
        const response = await axiosProxyInstance.get('http://localhost:3001/invalid-url');
        expect(response.status).toBe(404);
    }, TEST_TIMEOUT);



}); 
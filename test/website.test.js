const axios = require('axios');

const TEST_TIMEOUT = 30000;
const websites = [
    'https://www.ssv445.com',
    'https://readybytes.in/blog',
    'https://www.seoaffiliatedomination.com/blog',
    'https://authorkeynotes.com/',
    'https://linkstorm.io',
    'https://blog.linkody.com',
    'https://sitechecker.pro',
    'https://indexcheckr.com',
    'https://0mrr.com',

];

//filter out duplicates
const uniqueWebsites = [...new Set(websites)];

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
    timeout: 31000,
    maxContentLength: Infinity,
    maxBodyLength: Infinity,
});

const axiosInstance = axios.create({
    validateStatus: () => true,
    maxRedirects: 0,
    timeout: 1000,
});

describe('Websites Test', () => {
    beforeAll(async () => {
        // Check if servers are running
        const mockServerResponse = await axiosInstance.get('http://localhost:3001/success');
        expect(mockServerResponse.status).toBe(200);

        const proxyServerResponse = await axiosInstance.get('http://localhost:3000/ok');
        expect(proxyServerResponse.status).toBe(200);
    });

    test.each(uniqueWebsites)('should handle website: %s', async (website) => {
        const startTime = Date.now();

        try {
            const response = await axiosProxyInstance.get(website);
            console.log(`[${website}] Got response in ${Date.now() - startTime}ms, Status: ${response.status}, Content length: ${response.data?.length || 0}`);
            expect(response.status).toBe(200);
        } catch (error) {
            console.error(`[${website}] Error:`, error.message);
            throw error;
        }
    }, TEST_TIMEOUT);
}); 
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
});

// Add error event listener
axiosProxyInstance.interceptors.request.use(request => {
    request.metadata = { startTime: new Date() };
    return request;
});

axiosProxyInstance.interceptors.response.use(
    response => {
        response.config.metadata.endTime = new Date();
        response.duration = response.config.metadata.endTime - response.config.metadata.startTime;
        console.log(`Request took: ${response.duration}ms`);
        return response;
    },
    error => {
        console.error('Axios error:', error.code, error.message);
        throw error;
    }
);

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
        const response = await axiosProxyInstance.get(website);
        expect(response.status).toBe(200);
    }, TEST_TIMEOUT);
}); 
const axios = require('axios');

const TEST_TIMEOUT = 30000;



const axiosInstance = axios.create({
    validateStatus: () => true,
    maxRedirects: 0,
    timeout: TEST_TIMEOUT - 2000,
    maxContentLength: Infinity,
    maxBodyLength: Infinity,
    headers: {
        'x-api-key': '1234567890',
        'x-page-timeout-ms': (TEST_TIMEOUT - 4000).toString()
    }
});

describe('Load Tests', () => {
    beforeAll(async () => {
        // Check if servers are running
        const mockServerResponse = await axiosInstance.get('http://localhost:3001/success');
        expect(mockServerResponse.status).toBe(200);

        const proxyServerResponse = await axiosInstance.get('http://localhost:3000/ok');
        expect(proxyServerResponse.status).toBe(200);
    });


    //create a cpu load test for server, it should not crash
    test('cpu', async () => {
        const pageTimeout = 30000;
        const requestTimeout = pageTimeout * 6;
        //increase timeout of axiosInstance to 30 seconds
        axiosInstance.defaults.timeout = requestTimeout + 60000;
        let urls = [];
        for (let i = 0; i < 40; i++) {
            urls.push(`http://localhost:3000?render_url=http://localhost:3001/heavy-cpu?seconds=60&i=${i}`);
        }

        const promises = urls.map(async (url, index) => {
            //wait for random time between 1 and 20 seconds
            await new Promise(resolve => setTimeout(resolve, index * 1.5 * 1000));
            console.log(`Request ${url} started`);
            return axiosInstance.get(url, {
                headers: {
                    //css waits for 10secs
                    'x-page-timeout-ms': pageTimeout.toString(),
                }
            }).catch(err => {
                // Return error object instead of throwing
                return { status: err.code === 'ECONNABORTED' ? 'timeout' : 'error' };
            })
        }
        );

        const responses = await Promise.all(promises);
        console.log(responses.map(r => r.status));

        //some of the responses should be 200
        const twoHundredResponses = responses.filter(response => response.status === 200);
        expect(twoHundredResponses.length).toBeGreaterThan(0);
        // //some of the responses should be 503
        const fiveHundredThreeResponses = responses.filter(response => response.status === 503);
        expect(fiveHundredThreeResponses.length).toBeGreaterThan(0);

    }, 2 * 60 * 1000);
}); 
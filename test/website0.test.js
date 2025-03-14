
const { groupedWebsites, testWebsite, TEST_TIMEOUT } = require('./website_list');


describe('Websites Group 0 Test', () => {
    test.each(groupedWebsites[0])('[Group 0 ] should handle website: %s', testWebsite, TEST_TIMEOUT);
});

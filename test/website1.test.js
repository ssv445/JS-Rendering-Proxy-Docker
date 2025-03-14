
const { groupedWebsites, testWebsite, TEST_TIMEOUT } = require('./website_list');


describe('Websites Group 1 Test', () => {
    test.each(groupedWebsites[1])('[Group 1 ] should handle website: %s', testWebsite, TEST_TIMEOUT);
});

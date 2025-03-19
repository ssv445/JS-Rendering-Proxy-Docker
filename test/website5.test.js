
const { groupedWebsites, testWebsite, TEST_TIMEOUT } = require('./website_list');


describe('Websites Group 5 Test', () => {
    test.each(groupedWebsites[5])('[Group 5 ] should handle website: %s', testWebsite, TEST_TIMEOUT);
});

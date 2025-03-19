
const { groupedWebsites, testWebsite, TEST_TIMEOUT } = require('./website_list');


describe('Websites Group 6 Test', () => {
    test.each(groupedWebsites[6])('[Group 6 ] should handle website: %s', testWebsite, TEST_TIMEOUT);
});

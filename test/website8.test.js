
const { groupedWebsites, testWebsite, TEST_TIMEOUT } = require('./website_list');


describe('Websites Group 8 Test', () => {
    test.each(groupedWebsites[8])('[Group 8 ] should handle website: %s', testWebsite, TEST_TIMEOUT);
});

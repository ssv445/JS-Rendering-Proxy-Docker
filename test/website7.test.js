
const { groupedWebsites, testWebsite, TEST_TIMEOUT } = require('./website_list');


describe('Websites Group 7 Test', () => {
    test.each(groupedWebsites[7])('[Group 7 ] should handle website: %s', testWebsite, TEST_TIMEOUT);
});

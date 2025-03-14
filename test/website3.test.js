
const { groupedWebsites, testWebsite, TEST_TIMEOUT } = require('./website_list');


describe('Websites Group 3 Test', () => {
    test.each(groupedWebsites[3])('[Group 3 ] should handle website: %s', testWebsite, TEST_TIMEOUT);
});


const { groupedWebsites, testWebsite, TEST_TIMEOUT } = require('./website_list');


describe('Websites Group 4 Test', () => {
    test.each(groupedWebsites[4])('[Group 4 ] should handle website: %s', testWebsite, TEST_TIMEOUT);
});

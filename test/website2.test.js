
const { groupedWebsites, testWebsite, TEST_TIMEOUT } = require('./website_list');


describe('Websites Group 2 Test', () => {
    test.each(groupedWebsites[2])('[Group 2 ] should handle website: %s', testWebsite, TEST_TIMEOUT);
});

const websites = [
    'https://readybytes.in/blog',
    'https://www.seoaffiliatedomination.com/blog',
    'https://authorkeynotes.com/',
    'https://www.linkstorm.io/',
    'https://blog.linkody.com/',
    'https://sitechecker.pro/',
];

//filter out duplicates
const uniqueWebsites = [...new Set(websites)];

module.exports = uniqueWebsites;

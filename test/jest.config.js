const config = {
    testTimeout: 35000,
    testEnvironment: 'node',
    maxWorkers: 4,
    verbose: true,
    testMatch: ['**/basic.test.js', '**/website*.test.js'],
}

module.exports = config;
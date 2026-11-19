const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
    testDir: './tests',
    globalSetup: require.resolve('./tests/support/dependencies'),
    workers: 4,
    forbidOnly: true,
    use: {
        browserName: 'chromium',
        channel: process.env.PLAYWRIGHT_CHANNEL || (process.platform === 'win32' ? 'msedge' : undefined),
        serviceWorkers: 'block',
        trace: 'retain-on-failure',
    },
});

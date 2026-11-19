const { defineConfig } = require('@playwright/test');
const base = require('./playwright.config');

module.exports = defineConfig(base, {
    testMatch: '**/*.live.js',
    timeout: 90000,
    expect: { timeout: 20000 },
    workers: 1,
    outputDir: 'test-results/live',
});

const { defineConfig } = require('@playwright/test');
module.exports = defineConfig({
  testDir: './tests/browser',
  timeout: 90000,
  expect: { timeout: 15000 },
  workers: 2,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { baseURL: 'http://127.0.0.1:8080/birdnet-live-analyzer/', screenshot: 'only-on-failure' },
  projects: [
    { name: 'desktop', use: { browserName: 'chromium', viewport: { width: 1440, height: 1000 } } },
    { name: 'mobile', use: { browserName: 'chromium', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 } },
  ],
  webServer: { command: 'node node_modules/@11ty/eleventy/cmd.cjs --serve --port=8080', url: 'http://127.0.0.1:8080/birdnet-live-analyzer/', reuseExistingServer: false, timeout: 60000, env: { ELEVENTY_PATH_PREFIX: '/birdnet-live-analyzer/' } },
});

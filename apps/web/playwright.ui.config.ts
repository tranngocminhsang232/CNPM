import { defineConfig, devices } from '@playwright/test';

// UI contract checks use intercepted responses and require no database.
export default defineConfig({
  testDir: './test-ui',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: { baseURL: process.env.UI_BASE_URL || 'http://localhost:3000', trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: process.env.UI_BASE_URL
    ? undefined
    : {
        command: 'pnpm start',
        port: 3000,
        reuseExistingServer: !process.env.CI,
        timeout: 30000,
      },
});

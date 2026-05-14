import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:3000';

/**
 * Playwright config.
 *
 * The `webServer` block is intentionally commented out by default — the dev
 * stack needs MongoDB + (optionally) S3/n8n configured, which we do not want
 * Playwright to manage automatically. Start the stack yourself, then run:
 *
 *   cd server && npm run dev          # in one terminal
 *   cd client && npm run dev          # in another
 *   cd e2e    && npm test             # then run the suite
 *
 * Once a seed/teardown story exists for E2E, uncomment `webServer` and set
 * SEED_E2E=1 (or similar) so each run gets a clean DB.
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    // Add more browsers as needed:
    // { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    // { name: 'webkit',  use: { ...devices['Desktop Safari'] } },
  ],
  // webServer: [
  //   {
  //     command: 'cd ../server && npm run dev',
  //     url: 'http://localhost:5000/health',
  //     reuseExistingServer: !process.env.CI,
  //     timeout: 60_000,
  //   },
  //   {
  //     command: 'cd ../client && npm run dev',
  //     url: 'http://localhost:3000',
  //     reuseExistingServer: !process.env.CI,
  //     timeout: 60_000,
  //   },
  // ],
});

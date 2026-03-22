import { defineConfig, devices } from '@playwright/test';

const PROD_URL = process.env.BASE_URL || 'https://www.deepsightsynthesis.com';
const API_URL = process.env.API_URL || 'https://api.deepsightsynthesis.com';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: true,
  retries: 2,
  workers: 2,
  timeout: 30_000,
  expect: { timeout: 10_000 },

  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
    ['json', { outputFile: 'test-results.json' }],
  ],

  use: {
    baseURL: PROD_URL,
    extraHTTPHeaders: {
      'X-Test-Source': 'deepsight-monitoring',
    },
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'off',
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
  },

  projects: [
    {
      name: 'Desktop Chrome',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 13'] },
    },
  ],
});

export { API_URL };

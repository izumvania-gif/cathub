import { defineConfig, devices } from '@playwright/test';
import { APP_URL } from './support/env';

// End-to-end tests against a real PocketBase + the built web app + the bot talking to a
// Telegram Bot API mock. Requires `pnpm build` first. Run: pnpm e2e
export default defineConfig({
  testDir: './specs',
  globalSetup: './support/global-setup.ts',
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: APP_URL,
    locale: 'ru-RU',
    timezoneId: 'Europe/Moscow',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'api', testMatch: /(api|health)\.spec\.ts/ },
    { name: 'bot', testMatch: /bot\.spec\.ts/ },
    {
      name: 'web',
      testMatch: /web\.spec\.ts/,
      use: { ...devices['iPhone 13'], browserName: 'chromium' },
    },
  ],
});

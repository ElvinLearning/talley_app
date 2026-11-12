import { defineConfig, devices } from '@playwright/test'

// The browser tests create synthetic jobs. Point TALLEY_BASE_URL at a scratch
// instance (see README → Checks) to keep the demo database clean.
export default defineConfig({
  testDir: './tests',
  testMatch: '*.spec.js',
  timeout: 90000,
  workers: 1,
  use: { baseURL: process.env.TALLEY_BASE_URL || 'http://127.0.0.1:5173', screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1440, height: 1000 } } },
    { name: 'mobile', use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' } },
  ],
})

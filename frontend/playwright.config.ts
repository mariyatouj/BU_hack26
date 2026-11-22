import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.ts',
  timeout: 60000,
  workers: 1,
  use: {
    actionTimeout: 8000,
    channel: process.env.PW_CHANNEL ?? 'chrome',
    baseURL: 'http://127.0.0.1:4173',
    viewport: { width: 1280, height: 850 },
    video: process.env.RECORD_DEMO ? 'on' : 'off',
    launchOptions: { slowMo: process.env.RECORD_DEMO ? 280 : 0 },
  },
  webServer: {
    command: 'npm run preview -- --host 127.0.0.1 --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: false,
  },
})

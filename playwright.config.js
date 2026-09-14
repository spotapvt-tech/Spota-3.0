import { defineConfig, devices } from '@playwright/test';

// Minimal smoke-test config: runs against the Vite preview server (a real
// production build), matching what users actually get, rather than the dev
// server. Starts/stops that server for you — just run `npx playwright test`.
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'on-first-retry'
  },
  webServer: {
    command: 'npm run preview',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } }
  ]
});

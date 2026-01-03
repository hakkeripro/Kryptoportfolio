import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests-e2e',
  timeout: 30_000,
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: 'http://localhost:5173'
  },
  webServer: [
    {
      command: 'pnpm --filter @kp/api dev',
      url: 'http://localhost:8788/health',
      reuseExistingServer: !process.env.CI,
      env: { ...process.env, PORT: '8788', TEST_MODE: '1', JWT_SECRET: 'test-secret', DB_FILE: './data/e2e.sqlite' }
    },
    {
      command: 'pnpm --filter @kp/web dev',
      url: 'http://localhost:5173',
      reuseExistingServer: !process.env.CI
    }
  ]
});

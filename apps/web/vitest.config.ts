import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    // Only unit tests under src; Playwright e2e lives under tests-e2e
    include: ['src/**/*.{test,spec}.?(c|m)[jt]s?(x)'],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.{idea,git,cache,output,temp}/**',
      'tests-e2e/**',
      'playwright.config.{ts,js,mjs,cjs}'
    ]
  }
});

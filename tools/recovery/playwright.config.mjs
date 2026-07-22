import { defineConfig } from '@playwright/test';

export default defineConfig({
  outputDir: './test-results',
  use: {
    serviceWorkers: 'block',
  },
});

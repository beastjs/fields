import { defineConfig } from '@playwright/test';
import base from './playwright.config';

export default defineConfig({
  ...base,
  testIgnore: [],
  testMatch: '**/hosted-preview.spec.ts',
  webServer: {
    command: 'PLAYGROUND_PREVIEW_URL=http://localhost:3100/preview.html bun run build && bun run preview --host 127.0.0.1 --port 3100',
    url: 'http://127.0.0.1:3100',
    reuseExistingServer: false,
    timeout: 120000,
  },
});

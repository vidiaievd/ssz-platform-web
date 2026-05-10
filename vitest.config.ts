import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
import { playwright } from '@vitest/browser-playwright';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const dirname =
  typeof __dirname !== 'undefined' ? __dirname : path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      exclude: ['**/*.stories.*', '**/*.config.*', '.next/**', 'storybook-static/**'],
    },
    projects: [
      // Unit / integration tests — jsdom
      {
        plugins: [react()],
        test: {
          name: 'unit',
          environment: 'jsdom',
          globals: true,
          setupFiles: ['./vitest.setup.ts'],
          include: ['src/**/*.test.{ts,tsx}'],
          css: true,
        },
        resolve: {
          alias: {
            '@': path.resolve(dirname, './src'),
            'server-only': path.resolve(dirname, './src/test/server-only-shim.ts'),
            'next/headers': path.resolve(dirname, './src/test/next-headers-shim.ts'),
          },
        },
      },
      // Storybook interaction / a11y tests — real browser via Playwright
      {
        extends: true,
        plugins: [storybookTest({ configDir: path.join(dirname, '.storybook') })],
        test: {
          name: 'storybook',
          browser: {
            enabled: true,
            headless: true,
            provider: playwright({}),
            instances: [{ browser: 'chromium' }],
          },
        },
      },
    ],
  },
});

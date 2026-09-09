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
      thresholds: {
        statements: 70,
        branches: 65,
        functions: 70,
        lines: 70,
      },
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
        resolve: {
          alias: {
            // A story renders a client component in a real browser, and a client
            // component may import a server action — which Next compiles to a reference
            // and never ships, but a story loads for real, down to the server-only
            // environment underneath it. These two shims stop that descent at the
            // boundary Next would have stopped it at.
            'server-only': path.resolve(dirname, './src/test/server-only-shim.ts'),
            '@/lib/env': path.resolve(dirname, './src/test/env-browser-shim.ts'),
          },
        },
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

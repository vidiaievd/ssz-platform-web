// @vitest-environment node

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

const serverInit = vi.fn();

vi.mock('@sentry/nextjs', () => ({
  captureRequestError: vi.fn(),
  captureRouterTransitionStart: vi.fn(),
  init: vi.fn(),
}));
vi.mock('../sentry.server.config', () => {
  serverInit();
  return {};
});

const ROOT = resolve(__dirname, '..');

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('where Next finds the hooks', () => {
  it('keeps them beside app/, in src/ — a root copy is never loaded', () => {
    expect(existsSync(resolve(ROOT, 'src/instrumentation.ts'))).toBe(true);
    expect(existsSync(resolve(ROOT, 'src/instrumentation-client.ts'))).toBe(true);
    expect(existsSync(resolve(ROOT, 'instrumentation.ts'))).toBe(false);
  });

  it('has no old-style client config left to drift from the real one', () => {
    expect(existsSync(resolve(ROOT, 'sentry.client.config.ts'))).toBe(false);
  });
});

describe('server hooks', () => {
  it('hands request errors to Sentry', async () => {
    const Sentry = await import('@sentry/nextjs');
    const { onRequestError } = await import('./instrumentation');

    expect(onRequestError).toBe(Sentry.captureRequestError);
  });

  it('starts the server SDK in the Node runtime', async () => {
    vi.stubEnv('NEXT_RUNTIME', 'nodejs');
    const { register } = await import('./instrumentation');

    await register();

    expect(serverInit).toHaveBeenCalled();
  });
});

describe('client hooks', () => {
  it('starts the browser SDK and traces navigations', async () => {
    const Sentry = await import('@sentry/nextjs');
    const client = await import('./instrumentation-client');

    expect(Sentry.init).toHaveBeenCalledWith(expect.objectContaining({ debug: false }));
    expect(client.onRouterTransitionStart).toBe(Sentry.captureRouterTransitionStart);
  });
});

// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';

// services.ts copies the per-service URLs at import, so each case sets the env
// first and then loads a fresh copy of the module.
const fakeEnv = vi.hoisted(() => ({}) as Record<string, string | undefined>);
vi.mock('@/lib/env', () => ({ env: fakeEnv }));

async function load() {
  vi.resetModules();
  return (await import('./services')).resolveServiceUrl;
}

describe('resolveServiceUrl', () => {
  beforeEach(() => {
    for (const key of Object.keys(fakeEnv)) delete fakeEnv[key];
  });

  it('routes every service through the gateway when API_GATEWAY_URL is set, even with a per-service URL', async () => {
    fakeEnv.API_GATEWAY_URL = 'http://gateway.test/';
    fakeEnv.CONTENT_SERVICE_URL = 'http://content.test';
    const resolveServiceUrl = await load();

    expect(resolveServiceUrl('content')).toBe('http://gateway.test');
    expect(resolveServiceUrl('auth')).toBe('http://gateway.test');
  });

  it('uses the per-service URL when no gateway is set', async () => {
    fakeEnv.CONTENT_SERVICE_URL = 'http://content.test/';
    const resolveServiceUrl = await load();

    expect(resolveServiceUrl('content')).toBe('http://content.test');
  });

  it('throws when neither the gateway nor the service URL is set', async () => {
    const resolveServiceUrl = await load();
    expect(() => resolveServiceUrl('scheduling')).toThrow('No upstream configured for service "scheduling".');
  });
});

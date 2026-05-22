// @vitest-environment node

import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { server } from '@/test/msw/server';

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => (name === 'ssz_at' ? { value: 'test-token' } : undefined),
    set: () => undefined,
    delete: () => undefined,
  }),
  headers: async () => new Headers(),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

const { publishContainerAction } = await import('./publish-container');

describe('publishContainerAction', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns ok when the service publishes the container', async () => {
    server.use(
      http.post('http://content.test/api/v1/containers/ctr-1/publish', () =>
        new HttpResponse(null, { status: 204 }),
      ),
    );

    const result = await publishContainerAction('ctr-1');

    expect(result.ok).toBe(true);
  });

  it('returns conflict when the container is already published', async () => {
    server.use(
      http.post('http://content.test/api/v1/containers/ctr-1/publish', () =>
        HttpResponse.json({ title: 'Already published' }, { status: 409 }),
      ),
    );

    const result = await publishContainerAction('ctr-1');

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('conflict');
  });

  it('returns forbidden when the caller does not own the container', async () => {
    server.use(
      http.post('http://content.test/api/v1/containers/ctr-2/publish', () =>
        HttpResponse.json({ title: 'Forbidden' }, { status: 403 }),
      ),
    );

    const result = await publishContainerAction('ctr-2');

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('forbidden');
  });

  it('returns not_found for an unknown container', async () => {
    server.use(
      http.post('http://content.test/api/v1/containers/ghost/publish', () =>
        HttpResponse.json({ title: 'Not Found' }, { status: 404 }),
      ),
    );

    const result = await publishContainerAction('ghost');

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('not_found');
  });
});

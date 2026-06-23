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

const { createContainerAction, updateContainerAction } = await import('./container');

const VALID_INPUT = {
  title: 'Norwegian A1',
  containerType: 'course' as const,
  targetLanguage: 'nb',
  difficultyLevel: 'A1' as const,
  visibility: 'public' as const,
  accessTier: 'public_free' as const,
};

const CONTAINER_RESPONSE = {
  id: 'ctr-1',
  slug: null,
  title: 'Norwegian A1',
  containerType: 'course',
  targetLanguage: 'nb',
  difficultyLevel: 'A1',
  visibility: 'public',
  accessTier: 'public_free',
  currentPublishedVersionId: null,
  ownerUserId: 'user-1',
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-01-01T00:00:00Z',
};

describe('createContainerAction', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns the created container on success', async () => {
    server.use(
      http.post('http://content.test/api/v1/containers', () =>
        HttpResponse.json(CONTAINER_RESPONSE, { status: 201 }),
      ),
    );

    const result = await createContainerAction(VALID_INPUT);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.id).toBe('ctr-1');
  });

  it('returns a validation error on invalid input', async () => {
    const result = await createContainerAction({ ...VALID_INPUT, title: '' });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('validation');
  });

  it('returns an upstream error when the service returns 500', async () => {
    server.use(
      http.post('http://content.test/api/v1/containers', () =>
        HttpResponse.json({ title: 'Internal Server Error' }, { status: 500 }),
      ),
    );

    const result = await createContainerAction(VALID_INPUT);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('upstream_unavailable');
  });

  it('returns conflict when a slug is already taken', async () => {
    server.use(
      http.post('http://content.test/api/v1/containers', () =>
        HttpResponse.json({ title: 'Conflict' }, { status: 409 }),
      ),
    );

    const result = await createContainerAction(VALID_INPUT);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('conflict');
  });
});

describe('updateContainerAction', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns ok on a successful PATCH', async () => {
    server.use(
      http.patch('http://content.test/api/v1/containers/ctr-1', () =>
        new HttpResponse(null, { status: 204 }),
      ),
    );

    const result = await updateContainerAction('ctr-1', VALID_INPUT);

    expect(result.ok).toBe(true);
  });

  it('returns not_found when the container does not exist', async () => {
    server.use(
      http.patch('http://content.test/api/v1/containers/missing', () =>
        HttpResponse.json({ title: 'Not Found' }, { status: 404 }),
      ),
    );

    const result = await updateContainerAction('missing', VALID_INPUT);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('not_found');
  });
});

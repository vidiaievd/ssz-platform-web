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

const { ensureExplanationPublished, ensureVariantPublished } = await import('./ensure-published');

const VARIANT_PATH = 'http://content.test/api/v1/lessons/lesson-1/variants/ver-1/publish';
const EXPLANATION_PATH =
  'http://content.test/api/v1/grammar-rules/rule-1/explanations/exp-1/publish';

beforeEach(() => vi.clearAllMocks());

describe('ensureVariantPublished', () => {
  it('publishes a draft variant so students can reach the lesson', async () => {
    const called = vi.fn();
    server.use(
      http.post(VARIANT_PATH, () => {
        called();
        return new HttpResponse(null, { status: 204 });
      }),
    );

    await expect(ensureVariantPublished('lesson-1', 'ver-1')).resolves.toBeUndefined();
    expect(called).toHaveBeenCalledOnce();
  });

  it('treats an already published variant as success', async () => {
    server.use(
      http.post(VARIANT_PATH, () =>
        HttpResponse.json({ title: 'VARIANT_ALREADY_PUBLISHED' }, { status: 409 }),
      ),
    );

    await expect(ensureVariantPublished('lesson-1', 'ver-1')).resolves.toBeUndefined();
  });

  it('surfaces any other failure instead of leaving the lesson unpublishable', async () => {
    server.use(
      http.post(VARIANT_PATH, () => HttpResponse.json({ title: 'Forbidden' }, { status: 403 })),
    );

    await expect(ensureVariantPublished('lesson-1', 'ver-1')).rejects.toThrow();
  });
});

describe('ensureExplanationPublished', () => {
  it('publishes a draft explanation so the rule stops blocking pre-flight', async () => {
    const called = vi.fn();
    server.use(
      http.post(EXPLANATION_PATH, () => {
        called();
        return new HttpResponse(null, { status: 204 });
      }),
    );

    await expect(ensureExplanationPublished('rule-1', 'exp-1')).resolves.toBeUndefined();
    expect(called).toHaveBeenCalledOnce();
  });

  it('treats an already published explanation as success', async () => {
    server.use(
      http.post(EXPLANATION_PATH, () =>
        HttpResponse.json({ title: 'EXPLANATION_ALREADY_PUBLISHED' }, { status: 409 }),
      ),
    );

    await expect(ensureExplanationPublished('rule-1', 'exp-1')).resolves.toBeUndefined();
  });
});

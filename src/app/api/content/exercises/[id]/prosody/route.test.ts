// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api/server-fetcher', () => ({ serverFetch: vi.fn() }));

const { GET } = await import('./route');
import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors';

const params = Promise.resolve({ id: 'ex-1' });
const request = new Request('http://localhost/api/content/exercises/ex-1/prosody');

beforeEach(() => vi.mocked(serverFetch).mockReset());

describe('GET /api/content/exercises/[id]/prosody', () => {
  it('passes the learner layer through from content-service', async () => {
    const body = { prompts: [{ promptId: 'p1', text: 'Jeg heter Anna', layer: {} }] };
    vi.mocked(serverFetch).mockResolvedValueOnce(body);

    const res = await GET(request, { params });

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual(body);
    expect(serverFetch).toHaveBeenCalledWith({
      service: 'content',
      path: '/exercises/ex-1/prosody',
    });
  });

  it('answers an empty list when the service has nothing or fails', async () => {
    vi.mocked(serverFetch).mockRejectedValueOnce(new AppError('not_found', 'x'));
    expect((await (await GET(request, { params })).json()).prompts).toEqual([]);

    vi.mocked(serverFetch).mockRejectedValueOnce(new Error('boom'));
    expect((await (await GET(request, { params })).json()).prompts).toEqual([]);
  });

  it('keeps a missing session a 401', async () => {
    vi.mocked(serverFetch).mockRejectedValueOnce(new AppError('unauthenticated', 'x'));

    const res = await GET(request, { params });

    expect(res.status).toBe(401);
  });
});

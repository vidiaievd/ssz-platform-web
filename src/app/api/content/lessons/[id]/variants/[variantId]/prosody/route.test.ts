// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api/server-fetcher', () => ({ serverFetch: vi.fn() }));

const { GET } = await import('./route');
import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors';

const params = Promise.resolve({ id: 'les-1', variantId: 'var-1' });
const request = new Request('http://localhost/api/content/lessons/les-1/variants/var-1/prosody');

beforeEach(() => vi.mocked(serverFetch).mockReset());

describe('GET /api/content/lessons/[id]/variants/[variantId]/prosody', () => {
  it('passes the learner layer through from content-service', async () => {
    const body = { paragraphs: [{ paragraphIndex: 0, text: 'Hei', layer: {} }] };
    vi.mocked(serverFetch).mockResolvedValueOnce(body);

    const res = await GET(request, { params });

    await expect(res.json()).resolves.toEqual(body);
    expect(serverFetch).toHaveBeenCalledWith({
      service: 'content',
      path: '/lessons/les-1/variants/var-1/prosody',
    });
  });

  it('answers an empty list on any miss, and 401 without a session', async () => {
    vi.mocked(serverFetch).mockRejectedValueOnce(new AppError('forbidden', 'x'));
    expect((await (await GET(request, { params })).json()).paragraphs).toEqual([]);

    vi.mocked(serverFetch).mockRejectedValueOnce(new AppError('unauthenticated', 'x'));
    expect((await GET(request, { params })).status).toBe(401);
  });
});

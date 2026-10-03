// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

import { AppError } from '@/lib/errors';

vi.mock('@/lib/api/server-fetcher', () => ({ serverFetch: vi.fn() }));

const { GET } = await import('./route');
import { serverFetch } from '@/lib/api/server-fetcher';

const params = { params: Promise.resolve({ id: 'school-1' }) };
const COURSES = { total: 2, follow: 1, own: 1, none: 0, exceptions: [] };

beforeEach(() => vi.clearAllMocks());

describe('GET /api/content/coverage-recipes/workspaces/[id]/courses', () => {
  it('passes the counts through', async () => {
    vi.mocked(serverFetch).mockResolvedValue(COURSES as never);

    const res = await GET(new NextRequest('http://localhost/x'), params);

    expect(await res.json()).toEqual(COURSES);
    expect(serverFetch).toHaveBeenCalledWith({
      service: 'content',
      path: '/coverage-recipes/workspaces/school-1/courses',
    });
  });

  it('keeps a refusal a refusal', async () => {
    vi.mocked(serverFetch).mockRejectedValue(new AppError('forbidden', 'no'));

    const res = await GET(new NextRequest('http://localhost/x'), params);

    expect(res.status).toBe(403);
  });
});

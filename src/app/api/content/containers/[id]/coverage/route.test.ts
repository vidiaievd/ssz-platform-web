// @vitest-environment node

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/api/server-fetcher', () => ({ serverFetch: vi.fn() }));

const { GET } = await import('./route');
import { serverFetch } from '@/lib/api/server-fetcher';

const PARAMS = { params: Promise.resolve({ id: 'course-1' }) };

const REPORT = {
  containerId: 'course-1',
  containerType: 'course',
  title: 'Norsk B1',
  draft: {
    version: 'draft',
    available: true,
    coverage: {
      total: 4,
      bySkill: { listening: 0, reading: 4, spoken: 0, written: 1 },
      byFocus: { vocabulary: 2, grammar: 1, orthography: 0, pragmatics: 0, unknown: 1 },
      byForm: { bank: 3, free: 1, mixed: 0, unknown: 0 },
      emptySkills: ['listening', 'spoken'],
      unclassified: 0,
    },
    issues: [],
    modules: [],
  },
  published: null,
  diverges: false,
  differences: [],
};

function request(query = ''): NextRequest {
  return new NextRequest(`http://localhost/api/content/containers/course-1/coverage${query}`);
}

describe('GET /api/content/containers/[id]/coverage', () => {
  beforeEach(() => vi.mocked(serverFetch).mockReset());

  it('hands the report through untouched', async () => {
    vi.mocked(serverFetch).mockResolvedValueOnce(REPORT);

    const response = await GET(request(), PARAMS);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(REPORT);
  });

  it('defaults to the draft, which is what the author is editing', async () => {
    vi.mocked(serverFetch).mockResolvedValueOnce(REPORT);

    await GET(request(), PARAMS);

    expect(serverFetch).toHaveBeenCalledWith(
      expect.objectContaining({
        path: '/containers/course-1/coverage',
        query: { version: 'draft' },
      }),
    );
  });

  it('passes a recognised scope on', async () => {
    vi.mocked(serverFetch).mockResolvedValueOnce(REPORT);

    await GET(request('?version=both'), PARAMS);

    expect(serverFetch).toHaveBeenCalledWith(
      expect.objectContaining({ query: { version: 'both' } }),
    );
  });

  it('draws the draft for a scope it does not know, rather than failing', async () => {
    vi.mocked(serverFetch).mockResolvedValueOnce(REPORT);

    const response = await GET(request('?version=whatever'), PARAMS);

    expect(response.status).toBe(200);
    expect(serverFetch).toHaveBeenCalledWith(
      expect.objectContaining({ query: { version: 'draft' } }),
    );
  });

  it('reports a bad gateway rather than a course of zeroes', async () => {
    vi.mocked(serverFetch).mockRejectedValueOnce(new Error('upstream down'));

    const response = await GET(request(), PARAMS);

    expect(response.status).toBe(502);
  });
});

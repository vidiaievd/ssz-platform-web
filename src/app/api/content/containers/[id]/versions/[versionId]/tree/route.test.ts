// @vitest-environment node

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/api/server-fetcher', () => ({ serverFetch: vi.fn() }));

const { GET } = await import('./route');
import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors';
import type { CurriculumTree } from '@/features/content/types';

const PARAMS = { params: Promise.resolve({ id: 'course-1', versionId: 'version-1' }) };

const MOCK_TREE: CurriculumTree = {
  versionId: 'version-1',
  containerId: 'course-1',
  levelSystem: 'cefr',
  levels: [
    {
      id: 'level-a1',
      title: 'A1 — Beginner',
      position: 0,
      modules: [
        {
          id: 'item-module-1',
          containerId: 'module-1',
          versionId: 'module-version-1',
          title: 'Samfunn og kultur',
          titleEn: 'Society and culture',
          position: 0,
          isRequired: true,
          sections: [
            {
              id: 'section-1',
              title: 'Reinforce & read',
              position: 0,
              items: [
                {
                  id: 'item-1',
                  itemType: 'lesson',
                  refId: 'lesson-1',
                  title: 'En vanlig arbeidsdag',
                  position: 0,
                  isRequired: true,
                  lessonKind: 'text',
                  state: 'published',
                  durationMinutes: 6,
                  xpReward: 10,
                },
              ],
            },
          ],
          ungroupedItems: [],
        },
      ],
    },
  ],
};

function makeRequest() {
  return new NextRequest('http://localhost/api/content/containers/course-1/versions/version-1/tree');
}

beforeEach(() => vi.mocked(serverFetch).mockReset());

describe('GET /api/content/containers/[id]/versions/[versionId]/tree', () => {
  it('returns the curriculum tree on success', async () => {
    vi.mocked(serverFetch).mockResolvedValueOnce(MOCK_TREE);

    const res = await GET(makeRequest(), PARAMS);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(MOCK_TREE);
    expect(serverFetch).toHaveBeenCalledWith({
      service: 'content',
      path: '/containers/course-1/versions/version-1/tree',
    });
  });

  it('returns 401 when unauthenticated', async () => {
    vi.mocked(serverFetch).mockRejectedValueOnce(new AppError('unauthenticated', 'Not authenticated'));
    const res = await GET(makeRequest(), PARAMS);
    expect(res.status).toBe(401);
  });

  it('returns 404 when the version is not found', async () => {
    vi.mocked(serverFetch).mockRejectedValueOnce(new AppError('not_found', 'Version not found'));
    const res = await GET(makeRequest(), PARAMS);
    expect(res.status).toBe(404);
  });

  it('returns 502 on upstream failure', async () => {
    vi.mocked(serverFetch).mockRejectedValueOnce(new Error('network error'));
    const res = await GET(makeRequest(), PARAMS);
    expect(res.status).toBe(502);
  });
});

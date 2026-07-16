// @vitest-environment node

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/api/server-fetcher', () => ({ serverFetch: vi.fn() }));

const { GET } = await import('./route');
import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors';
import type { UnitContentsResult } from '@/features/learning/types';

const PARAMS = { params: Promise.resolve({ id: 'mod-1' }) };

const MOCK_CONTENTS: UnitContentsResult = {
  moduleId: 'mod-1',
  moduleTitle: 'Everyday routines',
  sections: [
    {
      id: 'sec-1',
      title: 'Reading',
      items: [
        {
          id: 'item-1',
          contentType: 'lesson',
          contentId: 'lesson-1',
          title: 'A morning in Oslo',
          lessonKind: 'TEXT',
          durationMinutes: 8,
          xpReward: 10,
          status: 'completed',
        },
        {
          id: 'item-2',
          contentType: 'lesson',
          contentId: 'lesson-2',
          title: 'Buying coffee',
          lessonKind: 'AUDIO',
          durationMinutes: 5,
          xpReward: 10,
          status: 'available',
        },
      ],
    },
  ],
  ungroupedItems: [
    {
      id: 'item-3',
      contentType: 'exercise',
      contentId: 'ex-1',
      title: 'Quick check',
      lessonKind: null,
      durationMinutes: null,
      xpReward: 5,
      status: 'locked',
    },
  ],
};

beforeEach(() => {
  vi.mocked(serverFetch).mockReset();
});

describe('GET /api/learning/units/[id]/contents', () => {
  it('returns the unit contents payload on success', async () => {
    vi.mocked(serverFetch).mockResolvedValueOnce(MOCK_CONTENTS);

    const res = await GET(new NextRequest('http://localhost/api/learning/units/mod-1/contents'), PARAMS);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual(MOCK_CONTENTS);
    expect(serverFetch).toHaveBeenCalledWith({
      service: 'progress',
      path: '/progress/units/mod-1/contents',
    });
  });

  it('returns 401 when unauthenticated', async () => {
    vi.mocked(serverFetch).mockRejectedValueOnce(new AppError('unauthenticated', 'Not authenticated'));
    const res = await GET(new NextRequest('http://localhost/api/learning/units/mod-1/contents'), PARAMS);
    expect(res.status).toBe(401);
  });

  it('returns 404 when the unit is not found', async () => {
    vi.mocked(serverFetch).mockRejectedValueOnce(new AppError('not_found', 'Unit not found'));
    const res = await GET(new NextRequest('http://localhost/api/learning/units/mod-1/contents'), PARAMS);
    expect(res.status).toBe(404);
  });

  it('returns 502 on upstream failure', async () => {
    vi.mocked(serverFetch).mockRejectedValueOnce(new Error('boom'));
    const res = await GET(new NextRequest('http://localhost/api/learning/units/mod-1/contents'), PARAMS);
    expect(res.status).toBe(502);
  });
});

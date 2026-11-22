// @vitest-environment node

import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('@/lib/api/server-fetcher', () => ({ serverFetch: vi.fn() }));

const { getMyHistory } = await import('./get-my-history');
import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors/app-error';

const fetchMock = vi.mocked(serverFetch);

const enrollment = (id: string, status: string, completedAt: string | null = null) => ({
  containerId: id,
  status,
  completedAt,
});

describe('getMyHistory', () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it('lists completed enrolments newest first and keeps a course that is gone for the learner', async () => {
    fetchMock.mockImplementation((async ({ path }: { path: string }) => {
      if (path === '/enrollments') {
        return [
          enrollment('active', 'ACTIVE'),
          enrollment('left', 'UNENROLLED'),
          enrollment('old', 'COMPLETED', '2026-01-01T00:00:00Z'),
          enrollment('shared', 'COMPLETED', '2026-11-01T00:00:00Z'),
          enrollment('deleted', 'completed', '2026-10-01T00:00:00Z'),
          enrollment('flaky', 'COMPLETED', '2026-09-01T00:00:00Z'),
        ];
      }
      const id = path.split('/').pop();
      if (id === 'shared') throw new AppError('forbidden', 'no_active_share');
      if (id === 'deleted') throw new AppError('not_found', 'gone');
      if (id === 'flaky') throw new AppError('server_error' as never, 'boom');
      return { id, title: `Title ${id}`, difficultyLevel: 'B1', targetLanguage: 'no' };
    }) as never);

    const items = await getMyHistory();

    expect(items.map((i) => [i.containerId, i.course?.title ?? null])).toEqual([
      ['shared', null],
      ['deleted', null],
      ['old', 'Title old'],
    ]);
  });

  it('answers an empty history when enrolments cannot be read', async () => {
    fetchMock.mockRejectedValue(new Error('down'));
    expect(await getMyHistory()).toEqual([]);
  });
});

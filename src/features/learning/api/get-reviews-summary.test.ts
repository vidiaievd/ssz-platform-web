// @vitest-environment node

import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('@/features/student/api/get-my-courses', () => ({ getMyCourses: vi.fn() }));
vi.mock('@/lib/api/server-fetcher', () => ({ serverFetch: vi.fn() }));
vi.mock('@/lib/env', () => ({
  env: {
    CONTENT_SERVICE_INTERNAL_URL: 'http://content:3000',
    INTERNAL_SERVICE_TOKEN: 'internal-token',
  },
}));

const { getReviewsSummary } = await import('./get-reviews-summary');
import { getMyCourses } from '@/features/student/api/get-my-courses';
import { serverFetch } from '@/lib/api/server-fetcher';
import type { StudentCourse } from '@/features/student/types';

const USER_ID = 'student-1';
const NOW = new Date('2026-07-20T12:00:00.000Z');

function course(overrides: Partial<StudentCourse> = {}): StudentCourse {
  return {
    containerId: 'course-nb',
    title: 'Norsk B1',
    targetLanguage: 'no',
    level: 'B1',
    source: 'self',
    school: null,
    started: true,
    progressPercent: 40,
    completedItems: 4,
    totalItems: 10,
    lastAccessedAt: null,
    nextItemId: null,
    nextItemTitle: null,
    ...overrides,
  };
}

function card(contentType: string, contentId: string, dueAt: string) {
  return { id: `card-${contentId}`, contentType, contentId, dueAt };
}

/**
 * Routes each upstream call by path so tests describe the world rather than a
 * call order — the aggregator fans out in parallel and reorders freely.
 */
function mockUpstream(routes: {
  due?: unknown;
  leafItems?: Record<string, unknown>;
  vocabItems?: Record<string, unknown>;
}) {
  vi.mocked(serverFetch).mockImplementation(async (opts: { path: string }) => {
    if (opts.path === '/srs/due') return routes.due ?? { cards: [] };

    const leaf = /^\/internal\/containers\/(.+)\/leaf-items$/.exec(opts.path);
    if (leaf?.[1]) return routes.leafItems?.[leaf[1]] ?? [];

    const vocab = /^\/vocabulary-lists\/(.+)\/items$/.exec(opts.path);
    if (vocab?.[1]) return routes.vocabItems?.[vocab[1]] ?? { items: [] };

    throw new Error(`unexpected path ${opts.path}`);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  vi.mocked(getMyCourses).mockReset();
  vi.mocked(serverFetch).mockReset();
});

describe('getReviewsSummary', () => {
  it('returns an empty summary when nothing is due', async () => {
    vi.mocked(getMyCourses).mockResolvedValue([course()]);
    mockUpstream({ due: { cards: [] } });

    const summary = await getReviewsSummary(USER_ID);

    expect(summary.totalDue).toBe(0);
    expect(summary.breakdown).toEqual([]);
    // No backlog means no reason to walk the course structure at all.
    expect(serverFetch).toHaveBeenCalledTimes(1);
  });

  it('attributes exercise and vocabulary cards to their course as separate rows', async () => {
    vi.mocked(getMyCourses).mockResolvedValue([course()]);
    mockUpstream({
      due: {
        cards: [
          card('EXERCISE', 'ex-1', '2026-07-20T08:00:00.000Z'),
          card('EXERCISE', 'ex-2', '2026-07-20T08:00:00.000Z'),
          card('VOCABULARY_WORD', 'word-1', '2026-07-20T09:00:00.000Z'),
        ],
      },
      leafItems: {
        'course-nb': [
          { type: 'EXERCISE', id: 'ex-1' },
          { type: 'EXERCISE', id: 'ex-2' },
          { type: 'VOCABULARY_LIST', id: 'list-1' },
          { type: 'LESSON', id: 'lesson-1' },
        ],
      },
      vocabItems: { 'list-1': { items: [{ id: 'word-1' }] } },
    });

    const summary = await getReviewsSummary(USER_ID);

    expect(summary.totalDue).toBe(3);
    expect(summary.byKind).toEqual({ exercise: 2, vocabulary_word: 1 });
    expect(summary.unattributedDue).toBe(0);
    expect(summary.breakdown).toEqual([
      {
        courseId: 'course-nb',
        courseTitle: 'Norsk B1',
        language: 'no',
        level: 'B1',
        kind: 'exercise',
        dueCount: 2,
      },
      {
        courseId: 'course-nb',
        courseTitle: 'Norsk B1',
        language: 'no',
        level: 'B1',
        kind: 'vocabulary_word',
        dueCount: 1,
      },
    ]);
  });

  it('counts cards it cannot place instead of dropping them', async () => {
    vi.mocked(getMyCourses).mockResolvedValue([course()]);
    mockUpstream({
      due: {
        cards: [
          card('EXERCISE', 'ex-1', '2026-07-20T08:00:00.000Z'),
          card('EXERCISE', 'orphan', '2026-07-20T08:00:00.000Z'),
          card('SOMETHING_NEW', 'ex-1', '2026-07-20T08:00:00.000Z'),
        ],
      },
      leafItems: { 'course-nb': [{ type: 'EXERCISE', id: 'ex-1' }] },
    });

    const summary = await getReviewsSummary(USER_ID);

    expect(summary.totalDue).toBe(3);
    expect(summary.unattributedDue).toBe(2);
    expect(summary.breakdown.reduce((n, r) => n + r.dueCount, 0) + summary.unattributedDue).toBe(3);
  });

  it('counts only cards that came due before today as overdue', async () => {
    vi.mocked(getMyCourses).mockResolvedValue([course()]);
    mockUpstream({
      due: {
        cards: [
          card('EXERCISE', 'ex-1', '2026-07-18T22:00:00.000Z'),
          card('EXERCISE', 'ex-2', '2026-07-20T06:00:00.000Z'),
        ],
      },
      leafItems: {
        'course-nb': [
          { type: 'EXERCISE', id: 'ex-1' },
          { type: 'EXERCISE', id: 'ex-2' },
        ],
      },
    });

    const summary = await getReviewsSummary(USER_ID);

    expect(summary.overdueCount).toBe(1);
  });

  it('skips the vocabulary expansion when no word cards are due', async () => {
    vi.mocked(getMyCourses).mockResolvedValue([course()]);
    mockUpstream({
      due: { cards: [card('EXERCISE', 'ex-1', '2026-07-20T08:00:00.000Z')] },
      leafItems: {
        'course-nb': [
          { type: 'EXERCISE', id: 'ex-1' },
          { type: 'VOCABULARY_LIST', id: 'list-1' },
        ],
      },
    });

    await getReviewsSummary(USER_ID);

    const paths = vi.mocked(serverFetch).mock.calls.map(([opts]) => (opts as { path: string }).path);
    expect(paths).not.toContain('/vocabulary-lists/list-1/items');
  });

  it('degrades to unattributed rather than failing when the course walk errors', async () => {
    vi.mocked(getMyCourses).mockResolvedValue([course()]);
    vi.mocked(serverFetch).mockImplementation(async (opts: { path: string }) => {
      if (opts.path === '/srs/due') {
        return { cards: [card('EXERCISE', 'ex-1', '2026-07-20T08:00:00.000Z')] };
      }
      throw new Error('content-service down');
    });

    const summary = await getReviewsSummary(USER_ID);

    expect(summary.totalDue).toBe(1);
    expect(summary.unattributedDue).toBe(1);
    expect(summary.breakdown).toEqual([]);
  });

  it('returns an empty summary when the due queue is unreachable', async () => {
    vi.mocked(getMyCourses).mockResolvedValue([course()]);
    vi.mocked(serverFetch).mockRejectedValue(new Error('learning-service down'));

    await expect(getReviewsSummary(USER_ID)).resolves.toMatchObject({ totalDue: 0 });
  });
});

// @vitest-environment node

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/api/server-fetcher', () => ({ serverFetch: vi.fn() }));

const { GET } = await import('./route');
import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors';
import type { Container, ContainerItem, ContainerSection } from '@/features/content/types';

const PARAMS = { params: Promise.resolve({ courseId: 'course-1' }) };

// Raw learning-service shapes (post course-redesign) — see route.ts adapter.
// Leaves carry `moduleId`/`isRequired` so the route can roll progress up per
// sub-lesson without extra fetches.
type RawStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';

function leaf(
  contentId: string,
  moduleId: string | null,
  status: RawStatus,
  isRequired = true,
) {
  return {
    contentType: 'LESSON',
    contentId,
    status,
    completedAt: status === 'COMPLETED' ? '2024-01-01T00:00:00Z' : null,
    score: null,
    moduleId,
    isRequired,
  };
}

/** mod-1 fully complete (2/2); mod-2 untouched (0/1). */
const RAW_PROGRESS = {
  containerId: 'course-1',
  totalItems: 3,
  completedItems: 2,
  completionRatio: 2 / 3,
  items: [
    leaf('lesson-1', 'mod-1', 'COMPLETED'),
    leaf('exercise-1', 'mod-1', 'COMPLETED'),
    leaf('vocab-1', 'mod-2', 'NOT_STARTED'),
  ],
};

const NOTHING_DONE = {
  ...RAW_PROGRESS,
  completedItems: 0,
  completionRatio: 0,
  items: [
    leaf('lesson-1', 'mod-1', 'NOT_STARTED'),
    leaf('exercise-1', 'mod-1', 'NOT_STARTED'),
    leaf('vocab-1', 'mod-2', 'NOT_STARTED'),
  ],
};

const ALL_DONE = {
  ...RAW_PROGRESS,
  completedItems: 3,
  completionRatio: 1,
  items: [
    leaf('lesson-1', 'mod-1', 'COMPLETED'),
    leaf('exercise-1', 'mod-1', 'COMPLETED'),
    leaf('vocab-1', 'mod-2', 'COMPLETED'),
  ],
};

const RAW_MASTERY = {
  containerId: 'course-1',
  vocab: 0.8,
  grammar: 0.6,
  reading: 0.5,
  listening: 0.7,
  spoken: 0.3,
  written: 0.2,
  overall: 0.55,
};

const RAW_SRS_DUE = {
  cards: [
    { contentType: 'VOCABULARY_WORD' as const },
    { contentType: 'VOCABULARY_WORD' as const },
    { contentType: 'EXERCISE' as const },
  ],
  reviewedToday: 3,
  dailyLimit: 20,
};

const RAW_SRS_STATS = {
  newCount: 0,
  learningCount: 0,
  reviewCount: 0,
  relearningCount: 0,
  suspendedCount: 0,
  dueNowCount: 12,
  reviewedTodayCount: 3,
};

const MOCK_CONTAINER: Partial<Container> = {
  id: 'course-1',
  title: 'Norwegian B1',
  difficultyLevel: 'B1',
  targetLanguage: 'nb',
  containerType: 'course',
  visibility: 'public',
  accessTier: 'public_free',
  ownerUserId: 'user-1',
  slug: 'norwegian-b1',
  currentPublishedVersionId: 'ver-1',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

const MOCK_ITEMS: Partial<ContainerItem>[] = [
  {
    id: 'ci-1',
    itemId: 'mod-1',
    itemType: 'container',
    position: 0,
    title: 'Everyday routines',
    containerVersionId: 'ver-1',
    isRequired: true,
    sectionId: 'section-1',
    addedAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 'ci-2',
    itemId: 'mod-2',
    itemType: 'container',
    position: 1,
    title: 'At the doctor',
    containerVersionId: 'ver-1',
    isRequired: true,
    sectionId: 'section-2',
    addedAt: '2024-01-01T00:00:00Z',
  },
];

const MOCK_SECTIONS: Partial<ContainerSection>[] = [
  { id: 'section-1', title: 'Leksjon 17', position: 0, containerVersionId: 'ver-1', createdAt: '2024-01-01T00:00:00Z' },
  { id: 'section-2', title: 'Leksjon 18', position: 1, containerVersionId: 'ver-1', createdAt: '2024-01-01T00:00:00Z' },
];

function makeRequest() {
  return new NextRequest('http://localhost/api/learning/course-home/course-1');
}

function mockAllSuccess() {
  mockUpstreams();
}

/** Wires the 7 upstream calls in the order route.ts issues them. */
function mockUpstreams(
  opts: { progress?: unknown; container?: Partial<Container> } = {},
) {
  vi.mocked(serverFetch)
    .mockResolvedValueOnce(opts.progress ?? RAW_PROGRESS)
    .mockResolvedValueOnce(RAW_MASTERY)
    .mockResolvedValueOnce(RAW_SRS_DUE)
    .mockResolvedValueOnce(RAW_SRS_STATS)
    .mockResolvedValueOnce(opts.container ?? MOCK_CONTAINER)
    .mockResolvedValueOnce(MOCK_ITEMS)
    .mockResolvedValueOnce(MOCK_SECTIONS);
}

beforeEach(() => vi.mocked(serverFetch).mockReset());

describe('GET /api/learning/course-home/[courseId]', () => {
  it('returns a composite payload on success', async () => {
    mockAllSuccess();

    const res = await GET(makeRequest(), PARAMS);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.courseInfo).toMatchObject({ id: 'course-1', title: 'Norwegian B1', cefrLevel: 'B1', targetLanguage: 'nb' });

    // Course-level progress maps straight from the raw totals.
    expect(body.progress.totalLessons).toBe(3);
    expect(body.progress.completedLessons).toBe(2);
    expect(body.progress.percentComplete).toBeCloseTo(66.67, 1);

    // Mastery: 0..1 raw ratios become 0..100 percents, keyed to the frontend's skill ids.
    expect(body.mastery.overallMastery).toBeCloseTo(55);
    expect(body.mastery.bySkill).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ skill: 'vocabulary', masteryPercent: 80 }),
        expect.objectContaining({ skill: 'speaking', masteryPercent: 30 }),
        expect.objectContaining({ skill: 'writing', masteryPercent: 20 }),
      ]),
    );

    expect(body.srsReviewedToday).toBe(3);
    // Total due count comes from /srs/stats/me; vocab/exercise split is estimated
    // from the /srs/due sample's contentType distribution.
    expect(body.srsDueCount).toBe(12);
    expect(body.srsVocabDue).toBe(2);
    expect(body.srsExerciseDue).toBe(1);

    // No hydrated can-do endpoint yet — degrades to empty rather than fabricating data.
    expect(body.canDo).toEqual({ items: [] });

    expect(body.overdueAssignmentCount).toBe(0);

    // Progress is rolled up per sub-lesson from the leaves' moduleId:
    // mod-1 is fully done (2/2), mod-2 untouched (0/1).
    expect(body.units).toHaveLength(2);
    expect(body.units[0]).toMatchObject({
      id: 'mod-1',
      title: 'Everyday routines',
      position: 0,
      status: 'done',
      completedLessons: 2,
      totalLessons: 2,
    });
    expect(body.units[1]).toMatchObject({
      id: 'mod-2',
      title: 'At the doctor',
      position: 1,
      status: 'active',
      completedLessons: 0,
      totalLessons: 1,
    });

    // Units grouped by their course-version section ("Leksjon"), in position order.
    expect(body.levels).toHaveLength(2);
    expect(body.levels[0]).toMatchObject({ id: 'section-1', title: 'Leksjon 17', position: 0 });
    expect(body.levels[0].units.map((u: { id: string }) => u.id)).toEqual(['mod-1']);
    expect(body.levels[1]).toMatchObject({ id: 'section-2', title: 'Leksjon 18', position: 1 });
    expect(body.levels[1].units.map((u: { id: string }) => u.id)).toEqual(['mod-2']);
  });

  it('fires 5 parallel + 2 parallel (items/sections) calls (7 total)', async () => {
    mockAllSuccess();

    await GET(makeRequest(), PARAMS);
    expect(vi.mocked(serverFetch)).toHaveBeenCalledTimes(7);
  });

  it('locks every unit but the first when gating is sequential and nothing is done', async () => {
    mockUpstreams({
      progress: NOTHING_DONE,
      container: { ...MOCK_CONTAINER, gatingMode: 'sequential' },
    });

    const res = await GET(makeRequest(), PARAMS);
    const body = await res.json();
    expect(body.units[0].status).toBe('active');
    expect(body.units[1].status).toBe('locked');
  });

  it('never locks a unit when gating is open', async () => {
    mockUpstreams({ progress: NOTHING_DONE });

    const res = await GET(makeRequest(), PARAMS);
    const body = await res.json();
    expect(body.units.map((u: { status: string }) => u.status)).toEqual(['active', 'active']);
  });

  it('unlocks the next unit once the previous one is complete (sequential)', async () => {
    mockUpstreams({ container: { ...MOCK_CONTAINER, gatingMode: 'sequential' } });

    const res = await GET(makeRequest(), PARAMS);
    const body = await res.json();
    // mod-1 done → mod-2 becomes the active one rather than staying locked.
    expect(body.units[0].status).toBe('done');
    expect(body.units[1].status).toBe('active');
  });

  it('treats a unit as complete when only optional items are outstanding', async () => {
    mockUpstreams({
      progress: {
        ...RAW_PROGRESS,
        items: [
          leaf('lesson-1', 'mod-1', 'COMPLETED'),
          leaf('exercise-1', 'mod-1', 'NOT_STARTED', false), // optional
          leaf('vocab-1', 'mod-2', 'NOT_STARTED'),
        ],
      },
      container: { ...MOCK_CONTAINER, gatingMode: 'sequential' },
    });

    const res = await GET(makeRequest(), PARAMS);
    const body = await res.json();
    expect(body.units[0].status).toBe('done');
    expect(body.units[1].status).toBe('active');
  });

  it('marks every unit done when the course is fully completed', async () => {
    mockUpstreams({ progress: ALL_DONE });

    const res = await GET(makeRequest(), PARAMS);
    const body = await res.json();
    expect(body.units[0].status).toBe('done');
    expect(body.units[1].status).toBe('done');
  });

  it('returns empty units and levels when course has no published version', async () => {
    const containerWithoutVersion = { ...MOCK_CONTAINER, currentPublishedVersionId: null };
    vi.mocked(serverFetch)
      .mockResolvedValueOnce(RAW_PROGRESS)
      .mockResolvedValueOnce(RAW_MASTERY)
      .mockResolvedValueOnce(RAW_SRS_DUE)
      .mockResolvedValueOnce(RAW_SRS_STATS)
      .mockResolvedValueOnce(containerWithoutVersion);

    const res = await GET(makeRequest(), PARAMS);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.units).toEqual([]);
    expect(body.levels).toEqual([]);
  });

  it('returns 401 when any upstream is unauthenticated', async () => {
    vi.mocked(serverFetch).mockRejectedValueOnce(new AppError('unauthenticated', 'Not authenticated'));
    const res = await GET(makeRequest(), PARAMS);
    expect(res.status).toBe(401);
  });

  it('returns 404 when the course is not found', async () => {
    vi.mocked(serverFetch).mockRejectedValueOnce(new AppError('not_found', 'Course not found'));
    const res = await GET(makeRequest(), PARAMS);
    expect(res.status).toBe(404);
  });

  it('returns 502 on upstream failure', async () => {
    vi.mocked(serverFetch).mockRejectedValueOnce(new Error('network error'));
    const res = await GET(makeRequest(), PARAMS);
    expect(res.status).toBe(502);
  });
});

// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api/server-fetcher', () => ({
  serverFetch: vi.fn(),
}));

const { realProvider } = await import('./real');
const { serverFetch } = await import('@/lib/api/server-fetcher');
const mockFetch = vi.mocked(serverFetch);

function respondByPath(routes: Record<string, unknown>) {
  mockFetch.mockImplementation(async ({ path }: { path: string }) => {
    if (path in routes) return routes[path];
    throw new Error(`unexpected path: ${path}`);
  });
}

describe('realProvider.coverQueue', () => {
  beforeEach(() => vi.clearAllMocks());

  it('enriches substitute requests with group and lesson data', async () => {
    respondByPath({
      '/scheduling/schools/s1/substitutions': [
        {
          id: 'r1', lessonId: 'l1', groupId: 'g1', originalTeacherId: 't1',
          coverFrom: '2026-01-05T00:00:00.000Z', coverTo: '2026-01-05T00:00:00.000Z',
          urgency: 'today', status: 'open',
        },
      ],
      '/schools/s1/groups': [{ id: 'g1', name: 'A1 Morning', lang: 'no' }],
      '/scheduling/groups/g1/lessons': [
        { id: 'l1', date: '2026-01-05', startTime: '09:00', endTime: '10:30' },
      ],
    });

    const queue = await realProvider.coverQueue('s1');
    expect(queue).toEqual([
      {
        requestId: 'r1',
        lessonId: 'l1',
        groupId: 'g1',
        groupName: 'A1 Morning',
        originalTeacherId: 't1',
        coverWindow: { from: '2026-01-05', to: '2026-01-05' },
        urgency: 'today',
        status: 'open',
        lang: 'no',
        day: 'Mon', // 2026-01-05 is a Monday
        start: '09:00',
        end: '10:30',
      },
    ]);
  });

  it('returns [] without enrichment fetches when the queue is empty', async () => {
    respondByPath({ '/scheduling/schools/s1/substitutions': [] });
    expect(await realProvider.coverQueue('s1')).toEqual([]);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('degrades gracefully when enrichment sources fail', async () => {
    mockFetch.mockImplementation(async ({ path }: { path: string }) => {
      if (path === '/scheduling/schools/s1/substitutions') {
        return [{
          id: 'r1', lessonId: 'l1', groupId: 'g1', originalTeacherId: 't1',
          coverFrom: '2026-01-05', coverTo: '2026-01-07',
          urgency: 'later', status: 'weird',
        }];
      }
      throw new Error('upstream down');
    });

    const [req] = await realProvider.coverQueue('s1');
    expect(req).toMatchObject({
      requestId: 'r1',
      groupName: '',
      urgency: 'open', // unknown value coerced
      status: 'open',
      start: '00:00',
      end: '00:00',
    });
  });
});

describe('realProvider.candidates', () => {
  beforeEach(() => vi.clearAllMocks());

  it('joins ranking output with the teacher roster and derives factors', async () => {
    respondByPath({
      '/scheduling/substitutions/req-1/candidates': [
        {
          teacherId: 't2', eligible: true, fitScore: 80,
          reasons: ['familiar-with-group', 'within-availability'],
          capScore: 30, disrScore: 20,
        },
        { teacherId: 't3', eligible: false, fitScore: 0, reasons: ['language-mismatch'] },
      ],
      '/schools/s1/members': [{ userId: 't2', name: 'Anna', avatarUrl: null }],
    });

    const [best, ineligible] = await realProvider.candidates('s1', 'req-1');

    expect(best).toEqual({
      teacherId: 't2',
      name: 'Anna',
      avatarUrl: null,
      eligible: true,
      fitScore: 80,
      classification: 'best',
      factors: {
        canLang: true,
        free: true,
        spareRatio: 0.75,
        familiar: true,
        wouldOverload: false,
        subLoop: false,
      },
    });

    expect(ineligible).toMatchObject({
      teacherId: 't3',
      name: '', // not in roster
      classification: 'ineligible',
      factors: { canLang: false },
    });
  });

  it('classifies by fitScore thresholds', async () => {
    respondByPath({
      '/scheduling/substitutions/req-1/candidates': [
        { teacherId: 'a', eligible: true, fitScore: 74, reasons: [] },
        { teacherId: 'b', eligible: true, fitScore: 50, reasons: [] },
        { teacherId: 'c', eligible: true, fitScore: 49, reasons: [] },
      ],
      '/schools/s1/members': [],
    });

    const result = await realProvider.candidates('s1', 'req-1');
    expect(result.map((c) => c.classification)).toEqual(['good', 'good', 'ok']);
  });
});

describe('realProvider curriculum', () => {
  beforeEach(() => vi.clearAllMocks());

  it('maps the backend plan, computing progressPct from capped delivered sessions', async () => {
    respondByPath({
      '/scheduling/groups/g1/curriculum': {
        id: 'p1',
        groupId: 'g1',
        schoolId: 's1',
        targetWeeklyHours: 4,
        units: [
          { id: 'u1', title: 'Greetings', order: 1, plannedSessions: 4, deliveredSessions: 4, requiredLevel: 'A1', status: 'done' },
          { id: 'u2', title: 'Numbers', order: 2, plannedSessions: 4, deliveredSessions: 6, requiredLevel: null, status: 'weird' },
        ],
      },
    });

    const plan = await realProvider.getCurriculum('g1');
    expect(plan.planId).toBe('p1');
    expect(plan.targetWeeklyHours).toBe(4);
    expect(plan.units).toEqual([
      { unitId: 'u1', title: 'Greetings', order: 1, plannedSessions: 4, deliveredSessions: 4, requiredLevel: 'A1', status: 'done' },
      { unitId: 'u2', title: 'Numbers', order: 2, plannedSessions: 4, deliveredSessions: 6, requiredLevel: 'A1', status: 'planned' },
    ]);
    // delivered capped at planned per unit: (4 + 4) / 8
    expect(plan.progressPct).toBe(100);
  });

  it('returns an empty plan when the group has no curriculum yet', async () => {
    respondByPath({ '/scheduling/groups/g1/curriculum': null });
    expect(await realProvider.getCurriculum('g1')).toEqual({
      planId: '', groupId: 'g1', units: [], targetWeeklyHours: 0, progressPct: 0,
    });
  });

  it('PUTs the full plan with units sorted by order', async () => {
    respondByPath({ '/scheduling/groups/g1/curriculum': { id: 'p1' } });

    await realProvider.putCurriculum('g1', {
      planId: 'p1',
      groupId: 'g1',
      targetWeeklyHours: 4,
      progressPct: 0,
      units: [
        { unitId: 'u2', title: 'B', order: 2, plannedSessions: 2, deliveredSessions: 0, requiredLevel: 'A1', status: 'planned' },
        { unitId: 'u1', title: 'A', order: 1, plannedSessions: 3, deliveredSessions: 1, requiredLevel: 'A2', status: 'active' },
      ],
    });

    expect(mockFetch).toHaveBeenCalledWith({
      service: 'scheduling',
      path: '/scheduling/groups/g1/curriculum',
      method: 'PUT',
      body: {
        targetWeeklyHours: 4,
        units: [
          { title: 'A', plannedSessions: 3, deliveredSessions: 1, requiredLevel: 'A2', status: 'active' },
          { title: 'B', plannedSessions: 2, deliveredSessions: 0, requiredLevel: 'A1', status: 'planned' },
        ],
      },
    });
  });
});

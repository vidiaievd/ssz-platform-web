// @vitest-environment node

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

vi.mock('@/lib/api/server-fetcher', () => ({ serverFetch: vi.fn() }));
vi.mock('@/features/content-authoring/lib/may-edit', () => ({ mayEditContainer: vi.fn() }));

const { GET } = await import('./route');
import { serverFetch } from '@/lib/api/server-fetcher';
import { mayEditContainer } from '@/features/content-authoring/lib/may-edit';

const PARAMS = { params: Promise.resolve({ id: 'course-1' }) };

const EXERCISE_ROW = {
  id: 'row-1',
  itemType: 'exercise',
  refId: 'ex-1',
  title: 'Oversett setningene',
  position: 1,
  isRequired: true,
  lessonKind: null,
  state: 'draft',
  isLive: null,
  pendingChange: null,
  durationMinutes: null,
  xpReward: null,
};

const TREE = {
  versionId: 'v1',
  containerId: 'course-1',
  containerType: 'course',
  levelSystem: 'cefr',
  publishState: 'draft',
  levels: [],
  ungroupedItems: [EXERCISE_ROW],
};

const ENTRY = {
  attemptId: 'att-1',
  userId: 'user-1',
  exerciseId: 'ex-1',
  templateCode: 'translate_to_target',
  submittedAnswer: [],
  submittedAt: '2026-08-15T09:00:00.000Z',
  timeSpentSeconds: 120,
  selfChecksUsed: 1,
  answersRevealed: false,
  details: null,
};

function request(query = ''): NextRequest {
  return new NextRequest(`http://localhost/api/content/containers/course-1/review-queue${query}`);
}

/**
 * Versions, the draft's tree, the engine's queue, then the directory — the handler's own
 * order.
 */
function upstream(
  tree: unknown = TREE,
  queue: unknown = { items: [ENTRY], total: 1, limit: 20, offset: 0 },
  profiles: unknown = [{ userId: 'user-1', displayName: 'Kari Nordmann' }],
) {
  vi.mocked(serverFetch)
    .mockResolvedValueOnce({ items: [{ id: 'v1', status: 'draft' }] })
    .mockResolvedValueOnce(tree)
    .mockResolvedValueOnce(queue)
    .mockResolvedValueOnce(profiles);
}

function engineCall() {
  return vi
    .mocked(serverFetch)
    .mock.calls.find(([args]) => (args as { service: string }).service === 'exercises')?.[0] as
    | { path: string; method?: string; body?: { exerciseIds: string[]; limit: number } }
    | undefined;
}

describe('GET /api/content/containers/[id]/review-queue', () => {
  beforeEach(() => {
    vi.mocked(serverFetch).mockReset();
    vi.mocked(mayEditContainer).mockReset().mockResolvedValue(true);
  });

  it('asks the engine about the exercises the course places, and names them back', async () => {
    upstream();

    const response = await GET(request(), PARAMS);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(engineCall()?.body?.exerciseIds).toEqual(['ex-1']);
    expect(body.items).toHaveLength(1);
    // The tree is the only place the exercise has a name — the queue is keyed by id.
    expect(body.exercises[0]).toMatchObject({
      exerciseId: 'ex-1',
      itemId: 'row-1',
      title: 'Oversett setningene',
    });
    // Neither service holds a name: without this join the teacher reads eight
    // characters of UUID where a pupil's name belongs.
    expect(body.learners['user-1'].displayName).toBe('Kari Nordmann');
  });

  it('serves the queue even when nobody can be named', async () => {
    vi.mocked(serverFetch)
      .mockResolvedValueOnce({ items: [{ id: 'v1', status: 'draft' }] })
      .mockResolvedValueOnce(TREE)
      .mockResolvedValueOnce({ items: [ENTRY], total: 1, limit: 20, offset: 0 })
      .mockRejectedValueOnce(new Error('directory down'));

    const response = await GET(request(), PARAMS);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.items).toHaveLength(1);
    expect(body.learners).toEqual({});
  });

  it('refuses before reading anything when the teacher may not edit the course', async () => {
    vi.mocked(mayEditContainer).mockResolvedValue(
      NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    );

    const response = await GET(request(), PARAMS);

    expect(response.status).toBe(403);
    // The queue lives behind an internal route with no opinion about who is asking:
    // the access check is the only thing standing in front of it.
    expect(serverFetch).not.toHaveBeenCalled();
  });

  it('answers an exercise-free course without troubling the engine', async () => {
    vi.mocked(serverFetch)
      .mockResolvedValueOnce({ items: [{ id: 'v1', status: 'draft' }] })
      .mockResolvedValueOnce({ ...TREE, ungroupedItems: [] });

    const response = await GET(request(), PARAMS);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      items: [],
      total: 0,
      limit: 0,
      offset: 0,
      exercises: [],
      learners: {},
    });
    expect(engineCall()).toBeUndefined();
  });

  it('passes paging through to the engine', async () => {
    upstream();

    await GET(request('?limit=50&offset=50'), PARAMS);

    expect(engineCall()?.body).toMatchObject({ limit: 50, offset: 50 });
  });

  it('reports a course it could not read as a bad gateway, not as an empty queue', async () => {
    vi.mocked(serverFetch).mockRejectedValueOnce(new Error('content down'));

    const response = await GET(request(), PARAMS);

    // An empty queue would read as "nothing to mark", which is the one wrong answer here.
    expect(response.status).toBe(502);
  });
});

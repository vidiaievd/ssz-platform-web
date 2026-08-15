// @vitest-environment node

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

vi.mock('@/lib/api/server-fetcher', () => ({ serverFetch: vi.fn() }));
vi.mock('@/features/content-authoring/lib/may-edit', () => ({ mayEditExercise: vi.fn() }));

const { GET } = await import('./route');
import { serverFetch } from '@/lib/api/server-fetcher';
import { mayEditExercise } from '@/features/content-authoring/lib/may-edit';

const PARAMS = { params: Promise.resolve({ id: 'ex-1' }) };

const ENTRY = {
  attemptId: 'att-1',
  userId: 'user-1',
  exerciseId: 'ex-1',
  templateCode: 'translate_to_target',
  submittedAnswer: [],
  submittedAt: '2026-08-15T09:00:00.000Z',
  timeSpentSeconds: 90,
  selfChecksUsed: 0,
  answersRevealed: false,
  details: null,
};

const request = () => new NextRequest('http://localhost/api/exercises/ex-1/review-queue');

describe('GET /api/exercises/[id]/review-queue', () => {
  beforeEach(() => {
    vi.mocked(serverFetch).mockReset();
    vi.mocked(mayEditExercise).mockReset().mockResolvedValue(true);
  });

  it('names the learner behind each submission', async () => {
    vi.mocked(serverFetch)
      .mockResolvedValueOnce({ items: [ENTRY], total: 1, limit: 20, offset: 0 })
      .mockResolvedValueOnce([{ userId: 'user-1', displayName: 'Kari Nordmann' }]);

    const response = await GET(request(), PARAMS);
    const body = await response.json();

    expect(response.status).toBe(200);
    // exercise-engine holds ids only: without this join the card shows eight
    // characters of UUID where the pupil's name belongs.
    expect(body.learners['user-1'].displayName).toBe('Kari Nordmann');
  });

  it('opens nothing when the teacher may not edit the exercise', async () => {
    vi.mocked(mayEditExercise).mockResolvedValue(
      NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    );

    const response = await GET(request(), PARAMS);

    expect(response.status).toBe(403);
    expect(serverFetch).not.toHaveBeenCalled();
  });
});

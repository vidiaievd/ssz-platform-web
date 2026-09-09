// @vitest-environment node

import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api/server-fetcher', () => ({ serverFetch: vi.fn() }));
vi.mock('@/lib/api/profile-directory', () => ({ fetchProfileSummaries: vi.fn() }));

const { GET } = await import('./route');
import { serverFetch } from '@/lib/api/server-fetcher';
import { fetchProfileSummaries } from '@/lib/api/profile-directory';
import { AppError } from '@/lib/errors';

const ATTEMPT = {
  status: 'RETURNED',
  templateCode: 'translate_to_target',
  reviewComment: 'Se på perfektum.',
  reviewedAt: '2026-08-19T11:00:00.000Z',
  reviewedByUserId: 'teacher-1',
  // Everything below is on the engine's record and has no business on a learner's screen.
  submittedAnswer: { answers: [{ itemId: 'i1', text: 'the actual answer' }] },
  validationDetails: { items: [{ itemId: 'i1', expected: 'do not leak me' }] },
  reviewDecisions: [{ itemId: 'i1', approved: false, comment: 'unreleased note' }],
};

const params = Promise.resolve({ id: 'ex-1', attemptId: 'att-1' });
const request = () => new NextRequest('http://localhost/api/exercises/ex-1/attempts/att-1/verdict');
const call = () => GET(request(), { params });

beforeEach(() => {
  vi.mocked(serverFetch).mockReset();
  vi.mocked(fetchProfileSummaries).mockReset();
  vi.mocked(serverFetch).mockResolvedValue(ATTEMPT);
  vi.mocked(fetchProfileSummaries).mockResolvedValue({
    'teacher-1': { userId: 'teacher-1', displayName: 'Kari Nordmann' },
  });
});

describe('GET /api/exercises/:id/attempts/:attemptId/verdict', () => {
  it('gives the runner the comment and who wrote it', async () => {
    const body = await (await call()).json();

    expect(body).toEqual({
      attemptId: 'att-1',
      exerciseId: 'ex-1',
      status: 'RETURNED',
      comment: 'Se på perfektum.',
      teacherName: 'Kari Nordmann',
      at: '2026-08-19T11:00:00.000Z',
    });
  });

  /** Invariant 1: nothing derived from the key reaches the learner, by omission not filter. */
  it('forwards nothing else off the engine’s record', async () => {
    const payload = JSON.stringify(await (await call()).json());

    expect(payload).not.toContain('the actual answer');
    expect(payload).not.toContain('do not leak me');
    expect(payload).not.toContain('unreleased note');
  });

  it('keeps the verdict when the directory cannot name the teacher', async () => {
    vi.mocked(fetchProfileSummaries).mockResolvedValue({});

    const body = await (await call()).json();

    expect(body.teacherName).toBeNull();
    expect(body.comment).toBe('Se på perfektum.');
  });

  it('does not go looking for a name nobody signed', async () => {
    vi.mocked(serverFetch).mockResolvedValue({ ...ATTEMPT, reviewedByUserId: null });

    const body = await (await call()).json();

    expect(fetchProfileSummaries).not.toHaveBeenCalled();
    expect(body.teacherName).toBeNull();
  });

  it('answers 404 for an attempt that is not this learner’s', async () => {
    vi.mocked(serverFetch).mockRejectedValue(new AppError('forbidden', 'Not your attempt'));

    expect((await call()).status).toBe(404);
  });
});

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  aiFirstFromAttempt,
  aiFirstFromSubmit,
  PROVISIONAL_GIVE_UP_MS,
  PROVISIONAL_POLL_MS,
  useProvisionalVerdict,
} from './use-provisional-verdict';

const VERDICT = {
  outcome: 'returned' as const,
  comment: 'Se på verbet.',
  at: '2026-11-27T10:01:00.000Z',
  countsAt: null,
};

/** Status answers in order (the last repeats); the attempt list carries `listed`. */
function mockApi(
  statuses: Array<{ status: string; provisional?: boolean } | null>,
  listed: { id: string; provisionalVerdict: typeof VERDICT | null } = {
    id: 'att-1',
    provisionalVerdict: VERDICT,
  },
) {
  let i = 0;
  return vi.fn((url: string) => {
    if (url.endsWith('/attempts')) {
      return Promise.resolve(new Response(JSON.stringify({ attempt: listed }), { status: 200 }));
    }
    const next = statuses[Math.min(i++, statuses.length - 1)];
    return Promise.resolve(
      next === null
        ? new Response('{}', { status: 502 })
        : new Response(JSON.stringify(next), { status: 200 }),
    );
  });
}

describe('useProvisionalVerdict (OQ-110)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('starts ready when the attempt was read back with the verdict, and asks nothing', async () => {
    const fetchMock = mockApi([{ status: 'ROUTED_FOR_REVIEW' }]);
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useProvisionalVerdict('ex-1', 'att-1', VERDICT));
    await act(() => vi.advanceTimersByTimeAsync(PROVISIONAL_POLL_MS * 3));

    expect(result.current).toEqual({ stage: 'ready', verdict: VERDICT });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('waits until the model answers, then reads its verdict with the attempt', async () => {
    const fetchMock = mockApi([
      { status: 'ROUTED_FOR_REVIEW', provisional: false },
      null,
      { status: 'ROUTED_FOR_REVIEW', provisional: true },
    ]);
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useProvisionalVerdict('ex-1', 'att-1', null));
    expect(result.current).toEqual({ stage: 'reading' });
    await act(() => vi.advanceTimersByTimeAsync(PROVISIONAL_POLL_MS * 2));
    expect(result.current).toEqual({ stage: 'reading' });
    await act(() => vi.advanceTimersByTimeAsync(PROVISIONAL_POLL_MS));

    expect(result.current).toEqual({ stage: 'ready', verdict: VERDICT });
    expect(fetchMock).toHaveBeenCalledWith('/api/exercises/ex-1/attempts/att-1');
    expect(fetchMock).toHaveBeenCalledWith('/api/exercises/ex-1/attempts');
  });

  it('says the work is settled when it left the queue meanwhile', async () => {
    vi.stubGlobal('fetch', mockApi([{ status: 'SCORED' }]));

    const { result } = renderHook(() => useProvisionalVerdict('ex-1', 'att-1', null));
    await act(() => vi.advanceTimersByTimeAsync(PROVISIONAL_POLL_MS));

    expect(result.current).toEqual({ stage: 'settled' });
  });

  it('gives up asking and says so', async () => {
    const fetchMock = mockApi([{ status: 'ROUTED_FOR_REVIEW', provisional: false }]);
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useProvisionalVerdict('ex-1', 'att-1', null));
    await act(() => vi.advanceTimersByTimeAsync(PROVISIONAL_GIVE_UP_MS + PROVISIONAL_POLL_MS));

    expect(result.current).toEqual({ stage: 'slow' });
    const asked = fetchMock.mock.calls.length;
    await act(() => vi.advanceTimersByTimeAsync(PROVISIONAL_POLL_MS * 5));
    expect(fetchMock.mock.calls.length).toBe(asked);
  });
});

describe('aiFirstFrom… (OQ-110)', () => {
  it('takes only work sent to a teacher with a model first', () => {
    const base = { attemptId: 'att-1', requiresReview: true };
    expect(aiFirstFromSubmit({ ...base, reviewer: 'teacher', aiFirst: true })).toEqual({
      attemptId: 'att-1',
      initial: null,
    });
    expect(aiFirstFromSubmit({ ...base, reviewer: 'teacher', aiFirst: false })).toBeNull();
    expect(aiFirstFromSubmit({ ...base, reviewer: 'teacher' })).toBeNull();
    expect(aiFirstFromSubmit({ ...base, reviewer: 'ai', aiFirst: true })).toBeNull();
    expect(aiFirstFromSubmit({ ...base, requiresReview: false, aiFirst: true })).toBeNull();
  });

  it('takes a read-back attempt still waiting, with the verdict it carries', () => {
    expect(
      aiFirstFromAttempt({ id: 'att-1', status: 'ROUTED_FOR_REVIEW', aiFirst: true, provisionalVerdict: VERDICT }),
    ).toEqual({ attemptId: 'att-1', initial: VERDICT });
    expect(aiFirstFromAttempt({ id: 'att-1', status: 'SCORED', aiFirst: true })).toBeNull();
    expect(aiFirstFromAttempt({ id: 'att-1', status: 'ROUTED_FOR_REVIEW' })).toBeNull();
  });
});

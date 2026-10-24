import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  AI_VERDICT_GIVE_UP_MS,
  AI_VERDICT_POLL_MS,
  handedInFromStatus,
  handedInFromSubmit,
  useAiVerdictWait,
} from './use-attempt';
import type { AttemptRecord, SubmitAnswerResponse } from '../types/attempts';

const RECORD: AttemptRecord = {
  id: 'att-1',
  exerciseId: 'ex-1',
  templateCode: 'translate_to_target',
  status: 'SCORED',
  checkMode: 'PRACTICE',
  score: 100,
  passed: true,
  answersRevealed: false,
  submittedAnswer: null,
  validationDetails: null,
  submittedAt: '2026-10-24T10:00:00.000Z',
  scoredAt: '2026-10-24T10:00:05.000Z',
  reviewComment: 'Godt.',
  reviewDecisions: [],
  reviewedAt: '2026-10-24T10:00:05.000Z',
  reviewedBy: 'ai',
  schoolId: null,
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

/** Status answers in turn (the last one repeats), then the attempt list. */
function mockApi(statuses: Array<string | null>, last: AttemptRecord | null = RECORD) {
  let asked = 0;
  return vi.fn(async (url: RequestInfo | URL) => {
    const path = String(url);
    if (/\/attempts\/[^/]+$/.test(path)) {
      const status = statuses[Math.min(asked, statuses.length - 1)];
      asked += 1;
      return status === null ? json({ error: 'nope' }, 502) : json({ status });
    }
    return json({ attempt: last });
  });
}

function statusCalls(fetchMock: ReturnType<typeof mockApi>) {
  return fetchMock.mock.calls.filter(([url]) => /\/attempts\/[^/]+$/.test(String(url))).length;
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('handedInFromSubmit / handedInFromStatus (plan 79, 2.3c2)', () => {
  const routed = { requiresReview: true } as SubmitAnswerResponse;

  it('reads the reviewer the engine named at hand-in', () => {
    expect(handedInFromSubmit({ ...routed, reviewer: 'ai' })).toBe('ai');
    expect(handedInFromSubmit({ ...routed, reviewer: 'teacher' })).toBe('review');
    expect(handedInFromSubmit({ ...routed, reviewer: 'none' })).toBe('unread');
    expect(handedInFromSubmit(routed)).toBe('review');
  });

  it('reads routed work with no school as waiting for a model', () => {
    expect(handedInFromStatus('ROUTED_FOR_REVIEW', null)).toBe('ai');
    expect(handedInFromStatus('ROUTED_FOR_REVIEW', 'school-1')).toBe('review');
    // An engine that does not send the field: as before the step.
    expect(handedInFromStatus('ROUTED_FOR_REVIEW')).toBe('review');
    expect(handedInFromStatus('NO_REVIEWER', null)).toBe('unread');
    expect(handedInFromStatus('SCORED', null)).toBe('passed');
  });
});

describe('useAiVerdictWait', () => {
  it('asks until the work leaves the queue, then hands over the attempt', async () => {
    const fetchMock = mockApi(['ROUTED_FOR_REVIEW', 'SCORED']);
    vi.stubGlobal('fetch', fetchMock);
    const onSettled = vi.fn();

    const { result } = renderHook(() => useAiVerdictWait('ex-1', 'att-1', true, onSettled));
    expect(result.current).toBe('reading');

    await act(() => vi.advanceTimersByTimeAsync(AI_VERDICT_POLL_MS));
    expect(onSettled).not.toHaveBeenCalled();
    await act(() => vi.advanceTimersByTimeAsync(AI_VERDICT_POLL_MS));

    expect(onSettled).toHaveBeenCalledWith(RECORD);
    expect(statusCalls(fetchMock)).toBe(2);
    expect(fetchMock).toHaveBeenCalledWith('/api/exercises/ex-1/attempts/att-1');

    // Settled: no more asking.
    await act(() => vi.advanceTimersByTimeAsync(AI_VERDICT_POLL_MS * 3));
    expect(statusCalls(fetchMock)).toBe(2);
  });

  it('hands over an attempt no model could read, closed as NO_REVIEWER', async () => {
    const closed = {
      ...RECORD,
      status: 'NO_REVIEWER' as const,
      reviewedAt: null,
      reviewedBy: null,
    };
    vi.stubGlobal('fetch', mockApi(['NO_REVIEWER'], closed));
    const onSettled = vi.fn();

    renderHook(() => useAiVerdictWait('ex-1', 'att-1', true, onSettled));
    await act(() => vi.advanceTimersByTimeAsync(AI_VERDICT_POLL_MS));

    expect(onSettled).toHaveBeenCalledWith(closed);
  });

  it('reads a failed status check as «not yet» and asks again', async () => {
    const fetchMock = mockApi([null, 'SCORED']);
    vi.stubGlobal('fetch', fetchMock);
    const onSettled = vi.fn();

    renderHook(() => useAiVerdictWait('ex-1', 'att-1', true, onSettled));
    await act(() => vi.advanceTimersByTimeAsync(AI_VERDICT_POLL_MS * 2));

    expect(onSettled).toHaveBeenCalledTimes(1);
  });

  it('shows nothing when the newest attempt is another one', async () => {
    vi.stubGlobal('fetch', mockApi(['SCORED'], { ...RECORD, id: 'att-2' }));
    const onSettled = vi.fn();

    renderHook(() => useAiVerdictWait('ex-1', 'att-1', true, onSettled));
    await act(() => vi.advanceTimersByTimeAsync(AI_VERDICT_POLL_MS));

    expect(onSettled).not.toHaveBeenCalled();
  });

  it('stops asking and says so once the model takes too long', async () => {
    const fetchMock = mockApi(['ROUTED_FOR_REVIEW']);
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useAiVerdictWait('ex-1', 'att-1', true, vi.fn()));
    await act(() => vi.advanceTimersByTimeAsync(AI_VERDICT_GIVE_UP_MS + AI_VERDICT_POLL_MS));

    expect(result.current).toBe('slow');
    const asked = statusCalls(fetchMock);
    await act(() => vi.advanceTimersByTimeAsync(AI_VERDICT_POLL_MS * 5));
    expect(statusCalls(fetchMock)).toBe(asked);
  });

  it('asks nothing while not waiting', async () => {
    const fetchMock = mockApi(['SCORED']);
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useAiVerdictWait('ex-1', 'att-1', false, vi.fn()));
    await act(() => vi.advanceTimersByTimeAsync(AI_VERDICT_POLL_MS * 3));

    expect(result.current).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

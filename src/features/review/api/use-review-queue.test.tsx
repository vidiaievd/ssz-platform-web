import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_FILTERS } from '../lib/queue-filters';
import type { ReviewQueueFilters, ReviewQueueResponse } from '../types';

import { useReviewQueue } from './use-review-queue';

const PENDING: ReviewQueueResponse = {
  summary: { pending: 4, overdue: 0, overduePartial: false, oldestHours: 3 },
  facets: { groups: [], courses: [] },
  groups: [],
  nextCursor: null,
};

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

/** The first request answers at once; every later one hangs, so the placeholder shows. */
function answerOnceThenHang() {
  let calls = 0;
  vi.stubGlobal(
    'fetch',
    vi.fn(() => {
      calls += 1;
      if (calls === 1) return Promise.resolve(new Response(JSON.stringify(PENDING)));
      return new Promise<Response>(() => {});
    }),
  );
}

afterEach(() => vi.unstubAllGlobals());

describe('useReviewQueue', () => {
  it('keeps the list on screen while a filter narrows it', async () => {
    answerOnceThenHang();
    const { result, rerender } = renderHook(
      ({ filters }: { filters: ReviewQueueFilters }) => useReviewQueue('nordick', filters),
      { wrapper, initialProps: { filters: DEFAULT_FILTERS } },
    );
    await waitFor(() => expect(result.current.data?.summary.pending).toBe(4));

    rerender({ filters: { ...DEFAULT_FILTERS, overdueOnly: true } });

    expect(result.current.data?.summary.pending).toBe(4);
  });

  it('does not pass the waiting queue off as the term view while that loads (plan 80, 7f)', async () => {
    answerOnceThenHang();
    const { result, rerender } = renderHook(
      ({ filters }: { filters: ReviewQueueFilters }) => useReviewQueue('nordick', filters),
      { wrapper, initialProps: { filters: DEFAULT_FILTERS } },
    );
    await waitFor(() => expect(result.current.data?.summary.pending).toBe(4));

    rerender({ filters: { ...DEFAULT_FILTERS, view: 'term' } });

    expect(result.current.data).toBeUndefined();
    expect(result.current.isPending).toBe(true);
  });
});

import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';

import { useFlushProgressOutbox, useUpsertProgress } from './use-upsert-progress';
import { enqueueProgress, readProgressOutbox } from '../lib/progress-outbox';

const PING = {
  contentType: 'LESSON',
  contentId: 'content-1',
  timeSpentSeconds: 30,
  completed: true,
};

function wrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

describe('useUpsertProgress', () => {
  let client: QueryClient;

  beforeEach(() => {
    window.localStorage.clear();
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });

  it('queues the ping in the outbox once retries are exhausted, without throwing to the caller', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ status: 502, ok: false }));

    const { result } = renderHook(() => useUpsertProgress('course-1', 'unit-1'), {
      wrapper: wrapper(client),
    });

    act(() => {
      result.current.mutate(PING);
    });
    // Two retries, backed off 1000ms and 2000ms.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    expect(result.current.isError).toBe(true);
    expect(readProgressOutbox()).toEqual([PING]);
    vi.useRealTimers();
  });

  it('does not queue an unauthenticated failure — there is nothing to resend', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ status: 401, ok: false }));

    const { result } = renderHook(() => useUpsertProgress('course-1', 'unit-1'), {
      wrapper: wrapper(client),
    });

    act(() => {
      result.current.mutate(PING);
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(readProgressOutbox()).toEqual([]);
  });

  it('drops a queued ping on success and does not re-queue it', async () => {
    enqueueProgress(PING);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ status: 200, ok: true, json: async () => ({ id: 'p1' }) }),
    );

    const { result } = renderHook(() => useUpsertProgress('course-1', 'unit-1'), {
      wrapper: wrapper(client),
    });

    act(() => {
      result.current.mutate(PING);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(readProgressOutbox()).toEqual([]);
  });
});

describe('useFlushProgressOutbox', () => {
  let client: QueryClient;

  beforeEach(() => {
    window.localStorage.clear();
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('resends a queued ping and clears it once the server accepts it', async () => {
    enqueueProgress(PING);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ status: 200, ok: true, json: async () => ({ id: 'p1' }) }),
    );

    const { result } = renderHook(() => useFlushProgressOutbox('course-1', 'unit-1'), {
      wrapper: wrapper(client),
    });
    await act(async () => {
      await result.current();
    });

    expect(readProgressOutbox()).toEqual([]);
  });

  it('leaves a ping that still fails for the next trigger to retry', async () => {
    enqueueProgress(PING);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ status: 502, ok: false }));

    const { result } = renderHook(() => useFlushProgressOutbox('course-1', 'unit-1'), {
      wrapper: wrapper(client),
    });
    await act(async () => {
      await result.current();
    });

    expect(readProgressOutbox()).toEqual([PING]);
  });

  it('does nothing when the outbox is empty', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useFlushProgressOutbox('course-1', 'unit-1'), {
      wrapper: wrapper(client),
    });
    await act(async () => {
      await result.current();
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });
});

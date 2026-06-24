import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';

import { useArchive, useNotificationsList } from './use-notifications';
import type { NotificationsResponse } from '../types';

const ITEM: NotificationsResponse['items'][number] = {
  id: 'n1',
  type: 'GENERAL',
  isRead: false,
  createdAt: new Date().toISOString(),
};

function wrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

/**
 * Routes by URL so the archive mutation and the list refetch don't share one
 * response. When the archive call succeeds, subsequent list refetches stop
 * returning the item — mirroring the real backend so the post-settle
 * `invalidateQueries()` refetch doesn't just resurrect what onMutate removed.
 */
function mockRoutedFetch(archiveResponse: { ok: boolean; status: number }) {
  let archived = false;
  return vi.fn((url: string) => {
    if (url.includes('/archive')) {
      if (archiveResponse.ok) archived = true;
      return Promise.resolve({ ...archiveResponse, json: async () => null });
    }
    return Promise.resolve({
      ok: true,
      json: async () => ({
        items: archived ? [] : [ITEM],
        unreadCount: archived ? 0 : 1,
        nextCursor: null,
      }),
    });
  });
}

describe('useArchive', () => {
  let client: QueryClient;

  beforeEach(() => {
    client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  });

  it('optimistically removes the item from the infinite-list cache', async () => {
    vi.stubGlobal('fetch', mockRoutedFetch({ ok: true, status: 204 }));

    const { result: list } = renderHook(() => useNotificationsList({ filter: 'all' }), {
      wrapper: wrapper(client),
    });
    await waitFor(() => expect(list.current.data?.pages[0]?.items).toHaveLength(1));

    const { result: archive } = renderHook(() => useArchive(), { wrapper: wrapper(client) });
    act(() => archive.current.mutate('n1'));

    await waitFor(() => expect(list.current.data?.pages[0]?.items).toHaveLength(0));
  });

  it('rolls back the optimistic removal when the archive request fails', async () => {
    vi.stubGlobal('fetch', mockRoutedFetch({ ok: false, status: 502 }));

    const { result: list } = renderHook(() => useNotificationsList({ filter: 'all' }), {
      wrapper: wrapper(client),
    });
    await waitFor(() => expect(list.current.data?.pages[0]?.items).toHaveLength(1));

    const { result: archive } = renderHook(() => useArchive(), { wrapper: wrapper(client) });
    act(() => archive.current.mutate('n1'));

    // onError restores the snapshot synchronously, so the optimistic removal
    // and its rollback can both resolve before this first observes either —
    // assert the converged end state rather than the transient "0".
    await waitFor(() => expect(archive.current.isError).toBe(true));
    expect(list.current.data?.pages[0]?.items).toHaveLength(1);
  });
});

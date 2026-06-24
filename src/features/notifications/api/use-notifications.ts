'use client';

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type {
  Notification,
  NotificationBulkAction,
  NotificationsResponse,
} from '../types';
import { notificationKeys, type NotificationsListFilters } from './keys';

async function fetchNotifications(params: {
  cursor?: string;
  filter?: string;
  type?: string;
}): Promise<NotificationsResponse> {
  const search = new URLSearchParams();
  if (params.cursor) search.set('cursor', params.cursor);
  if (params.filter) search.set('filter', params.filter);
  if (params.type) search.set('type', params.type);
  const qs = search.toString();
  const res = await fetch(`/api/notifications${qs ? `?${qs}` : ''}`);
  if (!res.ok) throw new Error('Failed to fetch notifications');
  return res.json() as Promise<NotificationsResponse>;
}

/** Lightweight feed for the bell popover: first page + unread count, no pagination. */
export function useNotifications() {
  return useQuery({
    queryKey: notificationKeys.bell(),
    queryFn: () => fetchNotifications({}),
    staleTime: 60_000,
    refetchInterval: 60_000,
  });
}

/** Full paginated feed for the notifications page, with filter/type and infinite scroll. */
export function useNotificationsList(filters: NotificationsListFilters) {
  const type = filters.type && filters.type !== 'all' ? filters.type : undefined;
  return useInfiniteQuery({
    queryKey: notificationKeys.infiniteList({ filter: filters.filter, type }),
    queryFn: ({ pageParam }: { pageParam: string | undefined }) =>
      fetchNotifications({ cursor: pageParam, filter: filters.filter, type }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    refetchOnWindowFocus: true,
  });
}

function invalidateAll(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: notificationKeys.all() });
}

type InfiniteNotifications = { pages: NotificationsResponse[]; pageParams: unknown[] };

/** Optimistically toggles `isRead` for a single notification across all cached list pages. */
function setReadInCache(
  queryClient: ReturnType<typeof useQueryClient>,
  id: string,
  isRead: boolean,
) {
  const patch = (n: Notification) => (n.id === id ? { ...n, isRead } : n);

  queryClient.setQueriesData<NotificationsResponse>({ queryKey: notificationKeys.bell() }, (data) =>
    data ? { ...data, items: data.items.map(patch) } : data,
  );
  queryClient.setQueriesData<InfiniteNotifications>(
    { queryKey: ['notifications', 'infinite-list'] },
    (data) =>
      data
        ? {
            ...data,
            pages: data.pages.map((page) => ({ ...page, items: page.items.map(patch) })),
          }
        : data,
  );
}

function removeFromCache(queryClient: ReturnType<typeof useQueryClient>, ids: string[]) {
  const idSet = new Set(ids);
  const dropItems = (items: Notification[]) => items.filter((n) => !idSet.has(n.id));

  queryClient.setQueriesData<NotificationsResponse>({ queryKey: notificationKeys.bell() }, (data) =>
    data ? { ...data, items: dropItems(data.items) } : data,
  );
  queryClient.setQueriesData<InfiniteNotifications>(
    { queryKey: ['notifications', 'infinite-list'] },
    (data) =>
      data
        ? { ...data, pages: data.pages.map((page) => ({ ...page, items: dropItems(page.items) })) }
        : data,
  );
}

export function useMarkRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/notifications/${id}/read`, { method: 'POST' });
      if (!res.ok && res.status !== 204) throw new Error('Failed to mark as read');
    },
    onMutate: (id) => setReadInCache(queryClient, id, true),
    onSettled: () => invalidateAll(queryClient),
  });
}

export function useMarkUnread() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/notifications/${id}/unread`, { method: 'POST' });
      if (!res.ok && res.status !== 204) throw new Error('Failed to mark as unread');
    },
    onMutate: (id) => setReadInCache(queryClient, id, false),
    onSettled: () => invalidateAll(queryClient),
  });
}

export function useMarkAllRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/notifications/read-all', { method: 'POST' });
      if (!res.ok && res.status !== 204) throw new Error('Failed to mark all as read');
    },
    onSettled: () => invalidateAll(queryClient),
  });
}

export function useArchive() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/notifications/${id}/archive`, { method: 'POST' });
      if (!res.ok && res.status !== 204) throw new Error('Failed to archive');
    },
    onMutate: (id) => removeFromCache(queryClient, [id]),
    onSettled: () => invalidateAll(queryClient),
  });
}

export function useUnarchive() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/notifications/${id}/unarchive`, { method: 'POST' });
      if (!res.ok && res.status !== 204) throw new Error('Failed to unarchive');
    },
    onMutate: (id) => removeFromCache(queryClient, [id]),
    onSettled: () => invalidateAll(queryClient),
  });
}

export function useDeleteNotification() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/notifications/${id}`, { method: 'DELETE' });
      if (!res.ok && res.status !== 204) throw new Error('Failed to delete');
    },
    onMutate: (id) => removeFromCache(queryClient, [id]),
    onSettled: () => invalidateAll(queryClient),
  });
}

export function useBulkAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ ids, action }: { ids: string[]; action: NotificationBulkAction }) => {
      const res = await fetch('/api/notifications/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids, action }),
      });
      if (!res.ok && res.status !== 204) throw new Error('Failed to perform bulk action');
    },
    onMutate: ({ ids, action }) => {
      if (action === 'archive' || action === 'delete') removeFromCache(queryClient, ids);
      if (action === 'read') ids.forEach((id) => setReadInCache(queryClient, id, true));
      if (action === 'unread') ids.forEach((id) => setReadInCache(queryClient, id, false));
    },
    onSettled: () => invalidateAll(queryClient),
  });
}

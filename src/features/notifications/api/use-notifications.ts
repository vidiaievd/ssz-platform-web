'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { NotificationsResponse } from '../types';
import { notificationKeys } from './keys';

async function fetchNotifications(): Promise<NotificationsResponse> {
  const res = await fetch('/api/notifications');
  if (!res.ok) throw new Error('Failed to fetch notifications');
  return res.json() as Promise<NotificationsResponse>;
}

export function useNotifications() {
  return useQuery({
    queryKey: notificationKeys.list(),
    queryFn: fetchNotifications,
    staleTime: 60_000,
    refetchInterval: 60_000,
  });
}

export function useMarkRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/notifications/${id}/read`, { method: 'POST' });
      if (!res.ok && res.status !== 204) throw new Error('Failed to mark as read');
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: notificationKeys.list() });
    },
  });
}

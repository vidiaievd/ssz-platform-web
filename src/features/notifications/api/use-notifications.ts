'use client';

import { useQuery } from '@tanstack/react-query';

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

import { keyFactory } from '@/lib/query/keys';
import type { NotificationFilter, NotificationType } from '../types';

export interface NotificationsListFilters {
  filter?: NotificationFilter;
  type?: NotificationType | 'all';
}

// `bell` and `infiniteList` must not share a key prefix: cached shapes differ
// ({ items, unreadCount } vs. an infinite-query { pages, pageParams }), and
// query-client cache scans match by prefix.
export const notificationKeys = keyFactory('notifications', {
  all: () => [] as const,
  bell: () => ['bell'] as const,
  infiniteList: (filters: NotificationsListFilters) => ['infinite-list', filters] as const,
});

import { keyFactory } from '@/lib/query/keys';
import type { NotificationFilter, NotificationType } from '../types';

export interface NotificationsListFilters {
  filter?: NotificationFilter;
  type?: NotificationType | 'all';
}

export const notificationKeys = keyFactory('notifications', {
  all: () => [] as const,
  list: () => ['list'] as const,
  infiniteList: (filters: NotificationsListFilters) => ['list', 'infinite', filters] as const,
});

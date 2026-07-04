import { describe, expect, it } from 'vitest';

import { groupNotificationsByDay } from './group-by-day';
import type { Notification } from '../types';

function makeNotification(id: string, createdAt: string): Notification {
  return { id, type: 'GENERAL', isRead: false, createdAt };
}

describe('groupNotificationsByDay', () => {
  it('groups items into today / yesterday / older buckets in order', () => {
    const now = new Date();
    const today = new Date(now);
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const older = new Date(now);
    older.setDate(older.getDate() - 5);

    const items = [
      makeNotification('a', today.toISOString()),
      makeNotification('b', yesterday.toISOString()),
      makeNotification('c', older.toISOString()),
    ];

    const groups = groupNotificationsByDay(items);

    expect(groups.map((g) => g.label)).toEqual(['today', 'yesterday', 'older']);
    expect(groups[0]!.items.map((n) => n.id)).toEqual(['a']);
  });

  it('keeps multiple same-day items in a single group', () => {
    const now = new Date();
    const items = [
      makeNotification('a', now.toISOString()),
      makeNotification('b', new Date(now.getTime() - 1000).toISOString()),
    ];

    const groups = groupNotificationsByDay(items);

    expect(groups).toHaveLength(1);
    expect(groups[0]!.items).toHaveLength(2);
  });

  it('returns an empty array for an empty list', () => {
    expect(groupNotificationsByDay([])).toEqual([]);
  });
});

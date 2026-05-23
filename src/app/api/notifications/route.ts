import { NextResponse } from 'next/server';

import type { Notification, NotificationsResponse } from '@/features/notifications/types';

export const MOCK_NOTIFICATIONS: Notification[] = [
  {
    id: 'notif-1',
    kind: 'enrollment_approved',
    title: 'Enrolment approved',
    body: 'Nordic Language Academy accepted your enrolment request.',
    readAt: null,
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'notif-2',
    kind: 'new_material',
    title: 'New lesson available',
    body: 'A new lesson "Definite articles" has been added to Norwegian for Beginners.',
    readAt: null,
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'notif-3',
    kind: 'lesson_assigned',
    title: 'Lesson assigned',
    body: 'Your tutor assigned "Verb conjugation" for this week.',
    readAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

export async function GET() {
  const unreadCount = MOCK_NOTIFICATIONS.filter((n) => n.readAt === null).length;
  const response: NotificationsResponse = { items: MOCK_NOTIFICATIONS, unreadCount };
  return NextResponse.json(response);
}

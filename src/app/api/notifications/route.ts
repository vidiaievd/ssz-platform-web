import { type NextRequest, NextResponse } from 'next/server';

import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors';
import type { NotificationsResponse } from '@/features/notifications/types';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const query: Record<string, string> = {};
  const cursor = searchParams.get('cursor');
  const limit = searchParams.get('limit');
  const filter = searchParams.get('filter');
  const type = searchParams.get('type');
  if (cursor) query.cursor = cursor;
  if (limit) query.limit = limit;
  if (filter) query.filter = filter;
  if (type) query.type = type;

  try {
    const data = await serverFetch<NotificationsResponse>({
      service: 'notification',
      path: '/notifications',
      query: Object.keys(query).length ? query : undefined,
    });
    return NextResponse.json(data);
  } catch (e) {
    if (e instanceof AppError && e.code === 'unauthenticated') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ items: [], unreadCount: 0 }, { status: 200 });
  }
}

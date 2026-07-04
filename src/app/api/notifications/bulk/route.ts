import { type NextRequest, NextResponse } from 'next/server';

import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors';
import type { NotificationBulkAction } from '@/features/notifications/types';

interface BulkRequestBody {
  ids: string[];
  action: NotificationBulkAction;
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as BulkRequestBody;

  try {
    await serverFetch({
      service: 'notification',
      path: '/notifications/bulk',
      method: 'POST',
      body,
    });
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    if (e instanceof AppError && e.code === 'unauthenticated') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to perform bulk action' }, { status: 502 });
  }
}

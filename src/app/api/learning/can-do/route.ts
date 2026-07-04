import { type NextRequest, NextResponse } from 'next/server';

import { serverFetch } from '@/lib/api/server-fetcher';
import { isAppError } from '@/lib/errors';
import type { CanDoResponse } from '@/features/learning/types';

export async function GET(request: NextRequest) {
  const courseId = request.nextUrl.searchParams.get('courseId');
  const query = courseId ? { courseId } : undefined;

  try {
    const data = await serverFetch<CanDoResponse>({
      service: 'progress',
      path: '/learning/can-do',
      query,
    });
    return NextResponse.json(data);
  } catch (e) {
    if (isAppError(e)) {
      if (e.code === 'unauthenticated') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to fetch can-do items' }, { status: 502 });
  }
}

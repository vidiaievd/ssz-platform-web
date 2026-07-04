import { type NextRequest, NextResponse } from 'next/server';

import { serverFetch } from '@/lib/api/server-fetcher';
import { isAppError } from '@/lib/errors';
import type { AssignmentListResponse } from '@/features/learning/types';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const courseId = searchParams.get('courseId');

  const query = courseId ? `?courseId=${encodeURIComponent(courseId)}` : '';

  try {
    const data = await serverFetch<AssignmentListResponse>({
      service: 'progress',
      path: `/assignments${query}`,
    });
    return NextResponse.json(data);
  } catch (e) {
    if (isAppError(e)) {
      if (e.code === 'unauthenticated') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to fetch assignments' }, { status: 502 });
  }
}

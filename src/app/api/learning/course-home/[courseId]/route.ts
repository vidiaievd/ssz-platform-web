import { type NextRequest, NextResponse } from 'next/server';

import { serverFetch } from '@/lib/api/server-fetcher';
import { isAppError } from '@/lib/errors';
import type {
  CanDoResponse,
  CourseMastery,
  CourseHomePayload,
  CourseProgress,
  SrsDueResponse,
} from '@/features/learning/types';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> },
) {
  const { courseId } = await params;

  try {
    const [progress, mastery, srsDue, canDo] = await Promise.all([
      serverFetch<CourseProgress>({
        service: 'progress',
        path: `/learning/progress/courses/${courseId}`,
      }),
      serverFetch<CourseMastery>({
        service: 'progress',
        path: `/learning/mastery/courses/${courseId}`,
      }),
      serverFetch<SrsDueResponse>({
        service: 'progress',
        path: '/srs/due',
      }),
      serverFetch<CanDoResponse>({
        service: 'progress',
        path: `/can-do?courseId=${encodeURIComponent(courseId)}`,
      }),
    ]);

    const payload: CourseHomePayload = {
      progress,
      mastery,
      srsDueCount: srsDue.dueCount,
      srsStreakDays: srsDue.streakDays,
      canDo,
    };

    return NextResponse.json(payload);
  } catch (e) {
    if (isAppError(e)) {
      if (e.code === 'unauthenticated') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      if (e.code === 'not_found') return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Failed to load course home' }, { status: 502 });
  }
}

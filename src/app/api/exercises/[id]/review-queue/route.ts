import { type NextRequest, NextResponse } from 'next/server';

import { serverFetch } from '@/lib/api/server-fetcher';
import { env } from '@/lib/env';
import { mayEditExercise } from '@/features/content-authoring/lib/may-edit';
import type { ReviewQueueResponse } from '@/features/content-authoring/types/review';

/**
 * The submissions of one exercise that are waiting on a teacher.
 *
 * Two calls, and the order is the point. exercise-engine holds the attempts but cannot
 * say who may read them — an attempt there carries a user and an exercise, no school and
 * no course. So content-service is asked first, with the teacher's own token, whether
 * they may edit this exercise; only then is the queue opened, over an internal route the
 * gateway does not expose. Skipping the first call would hand any signed-in learner their
 * classmates' work.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { searchParams } = request.nextUrl;

  const allowed = await mayEditExercise(id);
  if (allowed !== true) return allowed;

  try {
    const data = await serverFetch<ReviewQueueResponse>({
      service: 'exercises',
      path: '/internal/attempts/review',
      directBaseUrl: env.EXERCISE_SERVICE_INTERNAL_URL,
      headers: { 'x-internal-token': env.INTERNAL_SERVICE_TOKEN ?? '' },
      anonymous: true,
      query: {
        exerciseId: id,
        limit: searchParams.get('limit') ?? 20,
        offset: searchParams.get('offset') ?? 0,
      },
    });
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch the review queue' }, { status: 502 });
  }
}

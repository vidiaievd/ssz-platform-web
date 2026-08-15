import { type NextRequest, NextResponse } from 'next/server';

import { serverFetch } from '@/lib/api/server-fetcher';
import { fetchProfileSummaries } from '@/lib/api/profile-directory';
import { env } from '@/lib/env';
import { mayEditContainer } from '@/features/content-authoring/lib/may-edit';
import { collectCourseExercises } from '@/features/content-authoring/lib/collect-course-exercises';
import type { ContainerVersion, CurriculumTree } from '@/features/content/types';
import type {
  CourseReviewQueueResponse,
  ReviewQueueResponse,
} from '@/features/content-authoring/types/review';

/**
 * Everything waiting on a teacher across a whole course.
 *
 * Three calls, and the order is the point. exercise-engine holds the attempts but cannot
 * say who may read them — an attempt there carries a user and an exercise, no school and
 * no course. So content-service is asked first, with the teacher's own token, whether they
 * may edit *this course*; then the course's own tree gives the exercises to ask about; and
 * only then is the queue opened, over an internal route the gateway does not expose.
 *
 * Authorising against the course rather than against each exercise is what makes the
 * screen affordable: the exercises are the course's own material, so one answer covers all
 * of them. The tree is also the only place the exercises have names — the queue comes back
 * keyed by id — so it is sent down with the submissions rather than fetched again per card.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { searchParams } = request.nextUrl;

  const allowed = await mayEditContainer(id);
  if (allowed !== true) return allowed;

  let exercises;
  try {
    const versions = await serverFetch<{ items: ContainerVersion[] }>({
      service: 'content',
      path: `/containers/${id}/versions`,
    });
    // The draft: what the teacher is working on, and the version whose tree the editor
    // and this queue are both addressed through.
    const draft = versions.items.find((version) => version.status === 'draft');
    if (!draft) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const tree = await serverFetch<CurriculumTree>({
      service: 'content',
      path: `/containers/${id}/versions/${draft.id}/tree`,
    });
    exercises = collectCourseExercises(tree);
  } catch {
    return NextResponse.json({ error: 'Failed to read the course' }, { status: 502 });
  }

  // A course with no exercises has an empty queue by construction. Asking the engine
  // about an empty set would be a round trip to be told so.
  if (exercises.length === 0) {
    return NextResponse.json({
      items: [],
      total: 0,
      limit: 0,
      offset: 0,
      exercises: [],
      learners: {},
    } satisfies CourseReviewQueueResponse);
  }

  try {
    // The engine deals in ids: names are joined in below, not upstream.
    const queue = await serverFetch<Omit<ReviewQueueResponse, 'learners'>>({
      service: 'exercises',
      path: '/internal/attempts/review/search',
      method: 'POST',
      directBaseUrl: env.EXERCISE_SERVICE_INTERNAL_URL,
      headers: { 'x-internal-token': env.INTERNAL_SERVICE_TOKEN ?? '' },
      anonymous: true,
      body: {
        exerciseIds: exercises.map((exercise) => exercise.exerciseId),
        limit: Number(searchParams.get('limit') ?? 20),
        offset: Number(searchParams.get('offset') ?? 0),
      },
    });

    const learners = await fetchProfileSummaries(queue.items.map((entry) => entry.userId));

    return NextResponse.json({ ...queue, exercises, learners } satisfies CourseReviewQueueResponse);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch the review queue' }, { status: 502 });
  }
}

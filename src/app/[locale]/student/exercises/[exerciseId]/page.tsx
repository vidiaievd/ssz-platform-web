import { Suspense } from 'react';

import { RedoExercisePage } from '@/features/student/submissions';
import { Skeleton } from '@/components/ui/skeleton';

interface Props {
  params: Promise<{ exerciseId: string }>;
}

/**
 * `/student/exercises/<id>` — one exercise, addressed by itself (plan 47.3).
 *
 * The way back into a task from "Мои работы": a submission knows its exercise and nothing
 * about where that exercise sits in a course, so the reader's course/unit/item address
 * cannot be built from one. `?from=submission&attempt=<id>` turns the page into the second
 * go at a returned piece of work, with the teacher's comment above it.
 *
 * Client-rendered under Suspense for the same reason the submissions list is: everything
 * that decides what this page shows arrives in `useSearchParams`.
 */
export default async function StudentExercisePage({ params }: Props) {
  const { exerciseId } = await params;

  return (
    <Suspense fallback={<Skeleton className="mx-auto mt-6 h-96 w-full max-w-[760px]" />}>
      <RedoExercisePage exerciseId={exerciseId} />
    </Suspense>
  );
}

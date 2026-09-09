import { Suspense } from 'react';

import { MySubmissionsPage } from '@/features/student/submissions';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * `/student/submissions` — screen E of the review handoff (plan 47.2).
 *
 * Client-rendered under a Suspense boundary because the filter and the deeplinked
 * submission both live in `useSearchParams`, and the list itself is a thing a learner
 * comes back to refresh rather than a page that should be cached server-side.
 */
export default function StudentSubmissionsPage() {
  return (
    <Suspense fallback={<Skeleton className="mx-auto mt-6 h-96 w-full max-w-[760px]" />}>
      <MySubmissionsPage />
    </Suspense>
  );
}

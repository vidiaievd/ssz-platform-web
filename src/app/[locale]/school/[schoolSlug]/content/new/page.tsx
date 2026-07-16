import { Suspense } from 'react';

import { CreateCoursePage } from '@/features/content-authoring';

export default function NewContainerPage() {
  return (
    // Suspense required because CreateCoursePage reads useSearchParams()
    <Suspense>
      <CreateCoursePage />
    </Suspense>
  );
}

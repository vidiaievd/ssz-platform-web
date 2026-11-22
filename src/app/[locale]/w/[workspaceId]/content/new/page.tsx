import { Suspense } from 'react';

import { CreateCoursePage } from '@/features/content-authoring';
import { SchoolReadOnly } from '@/features/school-lifecycle/components/school-read-only';
import { isWorkspaceWritable } from '@/features/school-lifecycle/api/get-workspace-lifecycle';

export default async function NewContainerPage({ params }: { params: Promise<{ workspaceId: string }> }) {
  const { workspaceId } = await params;
  // Suspended or closed: nothing new is made here (plan 90, live check, block 9).
  if (!(await isWorkspaceWritable(workspaceId))) return <SchoolReadOnly />;

  return (
    // Suspense required because CreateCoursePage reads useSearchParams()
    <Suspense>
      <CreateCoursePage />
    </Suspense>
  );
}

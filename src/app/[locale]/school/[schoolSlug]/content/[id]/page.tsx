import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors';
import { Skeleton } from '@/components/ui/skeleton';
import type { Container, ContainerVersion } from '@/features/content/types';
import { CourseEditorShell } from '@/features/content-authoring/components/course-editor-shell';
import { getContainerPreflight } from '@/features/content-authoring/lib/get-container-preflight';
import type { PreflightResult, SchoolRole } from '@/features/content-authoring/types';
import { getMySchoolRole } from '@/features/school/api/get-my-school-role';

function TabsSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-40 w-full" />
    </div>
  );
}

export default async function ContainerDetailPage({
  params,
}: {
  params: Promise<{ schoolSlug: string; id: string }>;
}) {
  const { schoolSlug, id } = await params;
  const [t, orgRole] = await Promise.all([
    getTranslations('Authoring'),
    getMySchoolRole(schoolSlug),
  ]);

  const schoolRole: SchoolRole =
    orgRole === 'OWNER'
      ? 'owner'
      : orgRole === 'ADMIN' || orgRole === 'MANAGER' || orgRole === 'CONTENT_ADMIN'
        ? 'admin'
        : 'teacher';

  let container: Container;
  try {
    container = await serverFetch<Container>({
      service: 'content',
      path: `/containers/${id}`,
    });
  } catch (e) {
    if (e instanceof AppError && e.code === 'not_found') notFound();
    throw e;
  }

  // Every container keeps exactly one draft version — resolve it once for both
  // the preflight banner (draft state only) and the curriculum structure tab.
  let draftVersionId: string | null = null;
  let publishedVersionNumber: number | null = null;
  let preflight: PreflightResult | undefined;
  let preflightError = false;
  try {
    const versionsResp = await serverFetch<{ items: ContainerVersion[] }>({
      service: 'content',
      path: `/containers/${id}/versions`,
    });
    const draftVersion = versionsResp.items.find((v) => v.status === 'draft');
    draftVersionId = draftVersion?.id ?? null;
    publishedVersionNumber =
      versionsResp.items.find((v) => v.id === container.currentPublishedVersionId)?.versionNumber ??
      null;

    // Also for an already-published container: editing it opens a new draft
    // version, and re-publishing needs the same pre-flight as the first release.
    if (draftVersionId) {
      preflight = await getContainerPreflight(schoolSlug, id);
    }
  } catch (err) {
    console.error('[content/id] versions fetch failed:', err);
    preflightError = true;
  }

  return (
    <main className="mx-auto max-w-[1600px] px-6 py-6">
      <Suspense fallback={<TabsSkeleton />}>
        <CourseEditorShell
          container={container}
          schoolSlug={schoolSlug}
          schoolRole={schoolRole}
          preflightResult={preflight}
          draftVersionId={draftVersionId}
          publishedVersionNumber={publishedVersionNumber}
        />
      </Suspense>
      {preflightError && (
        <p className="mt-2 text-xs text-destructive">{t('structure.preflightUnavailable')}</p>
      )}
    </main>
  );
}

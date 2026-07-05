import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors';
import { Skeleton } from '@/components/ui/skeleton';
import { Link } from '@/lib/i18n/navigation';
import type { Container, ContainerItem, ContainerVersion } from '@/features/content/types';
import { AuthoringContainerTabs } from '@/features/content-authoring/components/authoring-container-tabs';
import { ContainerStateBadge, deriveContainerState } from '@/features/content-authoring/components/container-state-badge';
import { CourseStatusBanner } from '@/features/content-authoring/components/course-status-banner';
import { runPreflight } from '@/features/content-authoring/lib/preflight';
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
    orgRole === 'OWNER' ? 'owner'
    : orgRole === 'ADMIN' || orgRole === 'MANAGER' || orgRole === 'CONTENT_ADMIN' ? 'admin'
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

  const state = deriveContainerState(container);

  // Fetch preflight data server-side for draft containers to populate the status banner
  let preflight: PreflightResult | undefined;
  let preflightError = false;
  if (state === 'draft') {
    try {
      const versionsResp = await serverFetch<{ items: ContainerVersion[] }>({
        service: 'content',
        path: `/containers/${id}/versions`,
      });
      const draftVersion = versionsResp.items.find((v) => v.status === 'draft');
      const items = draftVersion
        ? await serverFetch<ContainerItem[]>({
            service: 'content',
            path: `/containers/${id}/versions/${draftVersion.id}/items`,
          })
        : [];
      preflight = runPreflight(schoolSlug, container, items);
    } catch (err) {
      console.error('[content/id] preflight versions fetch failed:', err);
      preflightError = true;
    }
  }

  return (
    <main className="p-8 max-w-7xl mx-auto">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground mb-5">
        <Link
          href={`/school/${schoolSlug}/content`}
          className="hover:text-foreground transition-colors"
        >
          {t('breadcrumb.courses')}
        </Link>
        <span aria-hidden>/</span>
        <span className="text-foreground font-medium truncate max-w-xs">{container.title}</span>
      </nav>

      {/* Header */}
      <div className="flex flex-wrap items-start gap-2 mb-4">
        <h1 className="text-2xl font-semibold">{container.title}</h1>
        <ContainerStateBadge state={state} className="mt-1" />
      </div>
      {container.description && (
        <p className="text-muted-foreground mb-4 text-sm">{container.description}</p>
      )}

      {/* Status banner */}
      <div className="mb-6">
        <CourseStatusBanner
          container={container}
          blockerCount={preflight?.blockerCount}
          warningCount={preflight?.warningCount}
        />
        {preflightError && (
          <p className="mt-2 text-xs text-destructive">
            Could not load readiness checks. Counts may be unavailable.
          </p>
        )}
      </div>

      <Suspense fallback={<TabsSkeleton />}>
        <AuthoringContainerTabs
          container={container}
          schoolRole={schoolRole}
          preflightResult={preflight}
        />
      </Suspense>
    </main>
  );
}

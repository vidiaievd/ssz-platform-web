import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors';
import { Breadcrumbs, type BreadcrumbItem } from '@/components/shared/breadcrumbs';
import { Button } from '@/components/ui/button';
import { Link } from '@/lib/i18n/navigation';
import type { Container, ContainerVersion, CurriculumTree } from '@/features/content/types';
import { ReviewQueue } from '@/features/content-authoring/components/review/review-queue';
import { findItemWithModule } from '@/features/content-authoring/lib/find-tree-item';
import { getMaterialKind } from '@/features/content-authoring/lib/material-kind';

/**
 * The marking queue of one exercise.
 *
 * A screen of its own rather than a panel in the editor: marking is a sitting, not a
 * glance, and the editor's two columns are already the author's document and the
 * student's view of it. The route hangs off the exercise because that is what the queue
 * is scoped to — and what the teacher's right to open it is checked against.
 */
export default async function ExerciseReviewPage({
  params,
}: {
  params: Promise<{ schoolSlug: string; id: string; itemId: string }>;
}) {
  const { schoolSlug, id, itemId } = await params;

  let container: Container;
  try {
    container = await serverFetch<Container>({ service: 'content', path: `/containers/${id}` });
  } catch (e) {
    if (e instanceof AppError && e.code === 'not_found') notFound();
    throw e;
  }

  const versionsResp = await serverFetch<{ items: ContainerVersion[] }>({
    service: 'content',
    path: `/containers/${id}/versions`,
  });
  const draftVersion = versionsResp.items.find((v) => v.status === 'draft');
  if (!draftVersion) notFound();

  const tree = await serverFetch<CurriculumTree>({
    service: 'content',
    path: `/containers/${id}/versions/${draftVersion.id}/tree`,
  });
  const found = findItemWithModule(tree, itemId);
  if (!found) notFound();

  // Only exercises are marked. Anything else reaching this URL is a typed address.
  if (getMaterialKind(found.item) !== 'exercise') notFound();

  const t = await getTranslations('Authoring');
  const backHref = `/school/${schoolSlug}/content/${id}`;
  const editorHref = `${backHref}/lessons/${itemId}`;

  const breadcrumbItems: BreadcrumbItem[] = [
    { label: t('breadcrumb.courses'), href: `/school/${schoolSlug}/content` },
    { label: container.title, href: backHref },
    { label: found.item.title ?? t('lessons.untitled'), href: editorHref },
    { label: t('review.title') },
  ];

  return (
    <main className="mx-auto max-w-3xl p-8">
      <Breadcrumbs items={breadcrumbItems} className="mb-5" />

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">{t('review.title')}</h1>
        <Button asChild variant="outline" size="sm">
          <Link href={editorHref}>{t('review.backToEditor')}</Link>
        </Button>
      </div>

      <ReviewQueue exerciseId={found.item.refId} />
    </main>
  );
}

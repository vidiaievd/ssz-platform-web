import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors';
import { Breadcrumbs, type BreadcrumbItem } from '@/components/shared/breadcrumbs';
import { Button } from '@/components/ui/button';
import { Link } from '@/lib/i18n/navigation';
import type { Container } from '@/features/content/types';
import { CourseReviewInbox } from '@/features/content-authoring/components/review/course-review-inbox';

/**
 * The marking inbox of a whole course.
 *
 * The per-exercise queue is opened from an exercise the teacher already has reason to
 * suspect something is waiting in. This screen is the question they actually start the day
 * with — "has anyone handed anything in?" — and without it the queue only helps people who
 * already knew the answer.
 */
export default async function CourseReviewPage({
  params,
}: {
  params: Promise<{ schoolSlug: string; id: string }>;
}) {
  const { schoolSlug, id } = await params;

  let container: Container;
  try {
    container = await serverFetch<Container>({ service: 'content', path: `/containers/${id}` });
  } catch (e) {
    if (e instanceof AppError && e.code === 'not_found') notFound();
    throw e;
  }

  const t = await getTranslations('Authoring');
  const courseHref = `/school/${schoolSlug}/content/${id}`;

  const breadcrumbItems: BreadcrumbItem[] = [
    { label: t('breadcrumb.courses'), href: `/school/${schoolSlug}/content` },
    { label: container.title, href: courseHref },
    { label: t('review.courseTitle') },
  ];

  return (
    <main className="mx-auto max-w-3xl p-8">
      <Breadcrumbs items={breadcrumbItems} className="mb-5" />

      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{t('review.courseTitle')}</h1>
          <p className="text-sm text-muted-foreground">{t('review.courseSubtitle')}</p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href={courseHref}>{t('review.backToCourse')}</Link>
        </Button>
      </div>

      <CourseReviewInbox containerId={id} schoolSlug={schoolSlug} />
    </main>
  );
}

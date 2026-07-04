import { notFound } from 'next/navigation';
import { LogIn } from 'lucide-react';

import { serverFetch } from '@/lib/api/server-fetcher';
import { readAccessToken } from '@/lib/auth/cookies';
import { AppError } from '@/lib/errors';
import { Button } from '@/components/ui/button';
import { Link } from '@/lib/i18n/navigation';
import { getTranslations } from 'next-intl/server';
import type { Container, ContainerItem } from '@/features/content/types';
import { CourseDetailView } from '@/features/student/components/course-detail-view';

interface Props {
  params: Promise<{ locale: string; slug: string }>;
}

export default async function CatalogueContainerPage({ params }: Props) {
  const { slug } = await params;
  const t = await getTranslations('Content');

  let container: Container;
  try {
    container = await serverFetch<Container>({
      service: 'content',
      path: `/containers/slug/${slug}`,
      anonymous: false,
    });
  } catch (e) {
    if (e instanceof AppError && e.code === 'not_found') notFound();
    return (
      <section className="container mx-auto max-w-3xl px-4 py-16 text-center">
        <LogIn className="text-muted-foreground mx-auto mb-4 h-10 w-10" />
        <h1 className="text-xl font-semibold">{t('signInToView')}</h1>
        <p className="text-muted-foreground mt-2 text-sm">{t('signInToViewDescription')}</p>
        <Button asChild className="mt-6">
          <Link href="/login">{t('signIn')}</Link>
        </Button>
      </section>
    );
  }

  const token = await readAccessToken();
  const isAuthenticated = !!token;

  /* Fetch the syllabus items if a published version exists */
  let items: ContainerItem[] = [];
  if (container.currentPublishedVersionId) {
    try {
      items = await serverFetch<ContainerItem[]>({
        service: 'content',
        path: `/containers/${container.id}/items?versionId=${container.currentPublishedVersionId}`,
        anonymous: !isAuthenticated,
      });
    } catch {
      // syllabus unavailable — render without items
    }
  }

  return (
    <CourseDetailView
      container={container}
      items={items}
      isEnrolled={false}
      gatedMode="preview"
    />
  );
}

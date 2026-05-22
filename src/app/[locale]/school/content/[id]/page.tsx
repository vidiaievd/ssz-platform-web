import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { ArrowLeft } from 'lucide-react';

import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Link } from '@/lib/i18n/navigation';
import type { Container } from '@/features/content/types';
import { AuthoringContainerTabs } from '@/features/content-authoring/components/authoring-container-tabs';

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
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const t = await getTranslations('Authoring');

  let container: Container;
  try {
    container = await serverFetch<Container>({
      service: 'content',
      path: `/api/v1/containers/${id}`,
    });
  } catch (e) {
    if (e instanceof AppError && e.code === 'not_found') notFound();
    throw e;
  }

  return (
    <main className="p-8">
      <div className="mb-8">
        <Button variant="ghost" size="sm" className="-ml-2 mb-4" asChild>
          <Link href="/school/content">
            <ArrowLeft className="mr-1 h-4 w-4" />
            {t('backToContent')}
          </Link>
        </Button>
        <div className="flex flex-wrap items-start gap-3">
          <h1 className="text-2xl font-semibold">{container.title}</h1>
          <Badge variant={container.isPublished ? 'success' : 'muted'}>
            {t(container.isPublished ? 'status.published' : 'status.draft')}
          </Badge>
        </div>
        {container.description && (
          <p className="text-muted-foreground mt-1 text-sm">{container.description}</p>
        )}
      </div>
      <Suspense fallback={<TabsSkeleton />}>
        <AuthoringContainerTabs container={container} />
      </Suspense>
    </main>
  );
}

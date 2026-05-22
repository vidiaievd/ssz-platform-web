import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';

import { Skeleton } from '@/components/ui/skeleton';
import { CatalogueClientView } from './catalogue-client';

export async function generateMetadata() {
  const t = await getTranslations('Content');
  return { title: t('catalogueTitle') };
}

export default async function CataloguePage() {
  const t = await getTranslations('Content');

  return (
    <section className="container mx-auto max-w-6xl px-4 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">{t('catalogueTitle')}</h1>
        <p className="text-muted-foreground mt-2">{t('catalogueSubtitle')}</p>
      </div>
      <Suspense
        fallback={
          <div className="space-y-4">
            <Skeleton className="h-10 w-96" />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-44 w-full rounded-xl" />
              ))}
            </div>
          </div>
        }
      >
        <CatalogueClientView />
      </Suspense>
    </section>
  );
}

import { Suspense } from 'react';
import { getTranslations } from 'next-intl/server';

import { Skeleton } from '@/components/ui/skeleton';
import { DiscoverSurface } from '@/features/discovery/components/discover-surface';

export default async function DiscoverPage() {
  const t = await getTranslations('Discovery');

  return (
    <main className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">{t('title')}</h1>
        <p className="text-muted-foreground mt-1 text-sm">{t('subtitle')}</p>
      </div>

      <Suspense
        fallback={
          <div className="space-y-6">
            <div className="flex flex-wrap gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-9 w-32 rounded-md" />
              ))}
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-52 w-full rounded-xl" />
              ))}
            </div>
          </div>
        }
      >
        <DiscoverSurface />
      </Suspense>
    </main>
  );
}

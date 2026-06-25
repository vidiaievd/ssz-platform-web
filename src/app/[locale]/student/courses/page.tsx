import { Suspense } from 'react';
import { getTranslations } from 'next-intl/server';

import { Skeleton } from '@/components/ui/skeleton';
import { DiscoverCoursesGrid } from '@/features/student/components/discover-courses-grid';

export default async function StudentCoursesPage() {
  const t = await getTranslations('Content');

  return (
    <main className="container mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">{t('discoverCoursesTitle')}</h1>
        <p className="text-muted-foreground mt-1 text-sm">{t('discoverCoursesSubtitle')}</p>
      </div>

      <Suspense
        fallback={
          <div className="space-y-6">
            <div className="flex flex-wrap gap-3">
              {Array.from({ length: 3 }).map((_, i) => (
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
        <DiscoverCoursesGrid />
      </Suspense>
    </main>
  );
}

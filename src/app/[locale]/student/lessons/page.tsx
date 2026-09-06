import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';

import { Skeleton } from '@/components/ui/skeleton';
import { PersonalRecommendations } from '@/features/content/components/personal-recommendations';

export default async function LessonsPage() {
  const t = await getTranslations('Content');

  return (
    <main className="container mx-auto max-w-page px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">{t('lessonsTitle')}</h1>
        <p className="text-muted-foreground mt-1 text-sm">{t('lessonsSubtitle')}</p>
      </div>
      <Suspense
        fallback={
          <div className="space-y-8">
            <Skeleton className="h-6 w-48" />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-44 w-full rounded-xl" />
              ))}
            </div>
          </div>
        }
      >
        <PersonalRecommendations />
      </Suspense>
    </main>
  );
}

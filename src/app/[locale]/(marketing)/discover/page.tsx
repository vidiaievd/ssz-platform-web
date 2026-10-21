import { Suspense } from 'react';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { getSchools } from '@/features/discovery/api/get-schools.server';
import { DiscoverSurface } from '@/features/discovery/components/discover-surface';
import { discoverFilterSchema } from '@/features/discovery/schemas';
import { Skeleton } from '@/components/ui/skeleton';
import type { Locale } from '@/lib/i18n/config';
import { localeAlternates } from '@/lib/seo';

interface PageProps {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({ params }: Pick<PageProps, 'params'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations('Discovery');
  return {
    title: t('title'),
    description: t('subtitle'),
    // Filters and the cursor live in the query string; every variant is this one page.
    alternates: localeAlternates(locale, '/discover'),
    openGraph: {
      title: t('title'),
      description: t('subtitle'),
    },
  };
}

function GridSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-52 w-full rounded-xl" />
      ))}
    </div>
  );
}

export default async function DiscoverPage({ searchParams }: PageProps) {
  const t = await getTranslations('Discovery');
  const rawParams = await searchParams;

  const flat: Record<string, string> = {};
  for (const [k, v] of Object.entries(rawParams)) {
    if (typeof v === 'string') flat[k] = v;
  }
  const filterResult = discoverFilterSchema.safeParse(flat);
  const filters = filterResult.success ? filterResult.data : {};

  let initialData;
  try {
    initialData = await getSchools({ ...filters, limit: 12 });
  } catch {
    initialData = undefined;
  }

  return (
    <div className="container mx-auto px-4 py-10">
      <div className="mb-10 max-w-2xl">
        <p className="label-overline mb-3 text-primary-600">{t('overline')}</p>
        <h1 className="text-[36px] font-extrabold leading-tight tracking-tight text-(--ssz-text-primary)">
          {t('pageTitle')}
        </h1>
        <p className="mt-3 text-[16px] leading-relaxed text-(--ssz-text-secondary)">
          {t('pageSubtitle')}
        </p>
      </div>

      <Suspense
        fallback={
          <div className="space-y-6">
            <div className="flex flex-wrap gap-3">
              {Array.from({ length: 2 }).map((_, i) => (
                <Skeleton key={i} className="h-9 w-32 rounded-md" />
              ))}
            </div>
            <GridSkeleton />
          </div>
        }
      >
        <DiscoverSurface initialData={initialData} initialQuery={filters} />
      </Suspense>
    </div>
  );
}

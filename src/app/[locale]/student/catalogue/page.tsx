import { Suspense } from 'react';
import { getTranslations } from 'next-intl/server';

import { DiscoverCatalog } from '@/features/student/components/discover-catalog';

export default async function StudentCataloguePage() {
  const t = await getTranslations('Catalog');

  return (
    <main className="mx-auto max-w-280 px-4.5 py-5.5 sm:px-9 sm:py-8.5">
      <div className="mb-6.5">
        <p className="mb-2 text-[11px] font-bold tracking-[0.08em] text-(--ssz-color-primary-500) uppercase">
          {t('eyebrow')}
        </p>
        <h1 className="mb-2 text-[26px] leading-tight font-bold tracking-[-0.02em] text-(--ssz-text-primary) sm:text-[30px]">
          {t('discover')}
        </h1>
        <p className="max-w-140 text-[15px] leading-relaxed text-(--ssz-text-secondary)">{t('discoverSub')}</p>
      </div>

      <Suspense>
        <DiscoverCatalog />
      </Suspense>
    </main>
  );
}

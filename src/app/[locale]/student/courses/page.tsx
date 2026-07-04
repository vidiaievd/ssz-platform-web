import { Suspense } from 'react';
import { getTranslations } from 'next-intl/server';

import { DiscoverCatalog } from '@/features/student/components/discover-catalog';

export default async function StudentCoursesPage() {
  const t = await getTranslations('Catalog');

  return (
    <main style={{ maxWidth: 1120, margin: '0 auto', padding: '34px 36px 72px' }}>
      {/* header block */}
      <div style={{ marginBottom: 26 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'var(--ssz-color-primary-500)',
            marginBottom: 8,
          }}
        >
          Catalog
        </div>
        <h1
          style={{
            fontSize: 30,
            fontWeight: 700,
            letterSpacing: '-0.02em',
            color: 'var(--ssz-text-primary)',
            marginBottom: 8,
            lineHeight: 1.15,
          }}
        >
          {t('discover')}
        </h1>
        <p
          style={{
            fontSize: 15,
            color: 'var(--ssz-text-secondary)',
            maxWidth: 560,
            lineHeight: 1.55,
          }}
        >
          {t('discoverSub')}
        </p>
      </div>

      <Suspense>
        <DiscoverCatalog />
      </Suspense>
    </main>
  );
}

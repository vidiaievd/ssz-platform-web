'use client';

import { useTranslations } from 'next-intl';

import { ContainerGrid } from './container-grid';

export function PersonalRecommendations() {
  const t = useTranslations('Content');

  return (
    <div className="space-y-10">
      <section>
        <h2 className="mb-4 text-xl font-semibold">{t('sectionContinueLearning')}</h2>
        <ContainerGrid
          scope="enrolled"
          buildHref={(slug) => `/student/catalogue/${slug}`}
        />
      </section>

      <section>
        <h2 className="mb-4 text-xl font-semibold">{t('sectionRecommended')}</h2>
        <ContainerGrid
          scope="public"
          buildHref={(slug) => `/catalogue/${slug}`}
        />
      </section>
    </div>
  );
}

import { getTranslations } from 'next-intl/server';

import { ReviewsView } from '@/features/student/reviews/components';

export default async function StudentReviewsPage() {
  const t = await getTranslations('Student.reviewsPage');

  return (
    <div className="mx-auto max-w-250 px-4.5 py-5.5 sm:px-8 sm:py-7.5">
      <p className="mb-1.5 text-[11px] font-bold tracking-[0.08em] text-(--ssz-color-primary-500) uppercase">
        {t('eyebrow')}
      </p>
      <h1 className="text-[23px] leading-tight font-bold tracking-[-0.02em] text-(--ssz-text-primary) sm:text-[28px]">
        {t('title')}
      </h1>
      <p className="mt-1.5 max-w-xl text-[14.5px] text-(--ssz-text-secondary)">{t('subtitle')}</p>

      <div className="mt-6">
        <ReviewsView />
      </div>
    </div>
  );
}

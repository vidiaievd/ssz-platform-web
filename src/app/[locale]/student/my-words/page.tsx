import { getTranslations } from 'next-intl/server';

import { MyWordsView } from '@/features/my-words/components/my-words-view';

export default async function StudentMyWordsPage() {
  const t = await getTranslations('Learning.myWords');

  return (
    <div className="mx-auto max-w-250 px-4.5 py-5.5 sm:px-8 sm:py-7.5">
      <p className="mb-1.5 text-[11px] font-bold tracking-[0.08em] text-(--ssz-color-primary-500) uppercase">
        {t('pageEyebrow')}
      </p>
      <h1 className="text-[23px] leading-tight font-bold tracking-[-0.02em] text-(--ssz-text-primary) sm:text-[28px]">
        {t('pageTitle')}
      </h1>
      <p className="mt-1.5 max-w-xl text-[14.5px] text-(--ssz-text-secondary)">
        {t('pageSubtitle')}
      </p>

      <div className="mt-6">
        <MyWordsView />
      </div>
    </div>
  );
}

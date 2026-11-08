import { getTranslations } from 'next-intl/server';

import { PronunciationSession } from '@/features/student/pronunciation';

/** `nb:kj`-shaped, as the engine's own validator wants it; anything else is ignored. */
const ATOM = /^[a-z]{2,3}:[a-z_]+$/;

export default async function StudentPronunciationPage({
  searchParams,
}: {
  searchParams: Promise<{ atom?: string | string[] }>;
}) {
  const { atom } = await searchParams;
  const atomId = typeof atom === 'string' && ATOM.test(atom) ? atom : undefined;
  const t = await getTranslations('Pronunciation');

  return (
    <div className="mx-auto max-w-200 px-4.5 py-5.5 sm:px-8 sm:py-7.5">
      <p className="mb-1.5 text-[11px] font-bold tracking-[0.08em] text-(--ssz-color-primary-500) uppercase">
        {t('eyebrow')} · {t('language')}
      </p>
      <h1 className="text-[23px] leading-tight font-bold tracking-[-0.02em] text-(--ssz-text-primary) sm:text-[28px]">
        {t('title')}
      </h1>
      <p className="mt-1.5 max-w-xl text-[14.5px] text-(--ssz-text-secondary)">{t('subtitle')}</p>

      <div className="mt-6">
        <PronunciationSession atomId={atomId} />
      </div>
    </div>
  );
}

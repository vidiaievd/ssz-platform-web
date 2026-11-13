import { getTranslations } from 'next-intl/server';

import { SoundCard } from '@/features/student/pronunciation';

export default async function StudentSoundCardPage({
  params,
}: {
  params: Promise<{ atomId: string }>;
}) {
  const { atomId } = await params;
  const t = await getTranslations('Pronunciation');

  return (
    <div className="mx-auto max-w-200 px-4.5 py-5.5 sm:px-8 sm:py-7.5">
      <p className="mb-1.5 text-[11px] font-bold tracking-[0.08em] text-(--ssz-color-primary-500) uppercase">
        {t('eyebrow')}
      </p>
      <h1 className="mb-5 text-[23px] leading-tight font-bold tracking-[-0.02em] text-(--ssz-text-primary) sm:text-[28px]">
        {t('card.open')}
      </h1>
      <SoundCard atomId={decodeURIComponent(atomId)} />
    </div>
  );
}

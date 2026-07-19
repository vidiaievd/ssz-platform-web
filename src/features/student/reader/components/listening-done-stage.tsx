'use client';

import { CheckCircle2, Zap } from 'lucide-react';
import { useTranslations } from 'next-intl';

export interface ListeningDoneStageProps {
  /** Per-item XP reward (`UnitContentsItem.xpReward`); omitted badge when null. */
  xpReward?: number | null;
}

export function ListeningDoneStage({ xpReward }: ListeningDoneStageProps) {
  const t = useTranslations('Learning.reader.listening.done');
  const tTopbar = useTranslations('Learning.reader.topbar');

  return (
    <div className="flex flex-col items-center gap-4 py-10 text-center">
      <div
        className="flex h-18 w-18 items-center justify-center rounded-full border-2"
        style={{ background: 'var(--ssz-color-success-50)', borderColor: 'var(--ssz-color-success-300)' }}
      >
        <CheckCircle2 size={36} style={{ color: 'var(--ssz-color-success-500)' }} aria-hidden="true" />
      </div>
      <div>
        <h2 className="font-reading mb-2 text-[26px] font-semibold text-(--ssz-text-primary)">
          {t('heading')}
        </h2>
        <p className="mx-auto max-w-105 text-[14.5px] leading-relaxed text-(--ssz-text-secondary)">
          {t('body')}
        </p>
      </div>
      {typeof xpReward === 'number' && xpReward > 0 && (
        <div
          className="mt-1.5 flex items-center gap-1.5 rounded-full border px-3 py-1.25"
          style={{ background: 'var(--ssz-color-secondary-100)', borderColor: 'var(--ssz-color-secondary-300)' }}
        >
          <Zap size={13} style={{ color: 'var(--ssz-color-secondary-700)' }} aria-hidden="true" />
          <span className="text-[13px] font-bold" style={{ color: 'var(--ssz-color-secondary-700)' }}>
            {tTopbar('xp', { xp: xpReward })}
          </span>
        </div>
      )}
    </div>
  );
}

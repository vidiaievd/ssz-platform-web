'use client';

import { CheckCircle2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

export function ListeningDoneStage() {
  const t = useTranslations('Learning.reader.listening.done');

  return (
    <div className="flex flex-col items-center gap-4 py-10 text-center">
      <div
        className="flex h-18 w-18 items-center justify-center rounded-full border-2"
        style={{ background: 'var(--ssz-feedback-ok-bg)', borderColor: 'color-mix(in oklab, var(--ssz-feedback-ok-line) 45%, transparent)' }}
      >
        <CheckCircle2 size={36} style={{ color: 'var(--ssz-feedback-ok-line)' }} aria-hidden="true" />
      </div>
      <div>
        <h2 className="font-reading mb-2 text-[26px] font-semibold text-(--ssz-text-primary)">
          {t('heading')}
        </h2>
        <p className="mx-auto max-w-105 text-[14.5px] leading-relaxed text-(--ssz-text-secondary)">
          {t('body')}
        </p>
      </div>
    </div>
  );
}

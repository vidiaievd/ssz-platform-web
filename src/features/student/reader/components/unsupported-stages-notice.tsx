'use client';

import { AlertCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';

export interface UnsupportedStagesNoticeProps {
  /** How many staged exercises this lesson could not draw. Nothing renders at zero. */
  count: number;
}

/**
 * Says out loud that part of the lesson is missing.
 *
 * A stage whose exercise the reader cannot parse used to be filtered out of the list and
 * that was the whole story: the lesson simply had fewer questions than its author wrote,
 * and neither the student nor anyone reading the screen could tell. Plan 53 phase 6 —
 * a refusal the student can see, in place of a stage that disappeared.
 */
export function UnsupportedStagesNotice({ count }: UnsupportedStagesNoticeProps) {
  const t = useTranslations('Learning.reader.unsupportedStages');

  if (count <= 0) return null;

  return (
    <div
      role="status"
      className="mb-4 flex items-start gap-2.5 rounded-xl border border-(--ssz-border-default) bg-surface px-4 py-3"
    >
      <AlertCircle
        size={17}
        aria-hidden="true"
        className="mt-0.5 shrink-0 text-(--ssz-text-muted)"
      />
      <div>
        <p className="text-sm font-semibold text-(--ssz-text-primary)">{t('title', { count })}</p>
        <p className="mt-0.5 text-sm text-(--ssz-text-muted)">{t('body')}</p>
      </div>
    </div>
  );
}

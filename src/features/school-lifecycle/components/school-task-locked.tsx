'use client';

import { Lock } from 'lucide-react';
import { useTranslations } from 'next-intl';

export interface SchoolTaskLockedProps {
  line?: string;
  /** Inside a practice stack, whose task card already frames it. */
  bare?: boolean;
  /**
   * The learner's unfinished text on an attempt opened before the school stopped (plan 90, live
   * check block 12; owner's decision: shown read only, nothing can be handed in). Empty = none.
   */
  draft?: string | null;
  /** Words the note under the draft: a suspended school may come back, a closed one will not. */
  status?: 'suspended' | 'closed' | 'purged' | null;
}

/**
 * In place of a server-graded task while the course's school is suspended, closed or gone
 * (plan 90, live check, block 9). The engine would refuse the start and the hand-in anyway;
 * this keeps the learner from typing an answer nobody will take. The banner above the task
 * says why; tasks the browser grades itself stay open. A draft begun before the school stopped
 * is shown under the lock, read only — it is the learner's own writing and must not vanish.
 */
export function SchoolTaskLocked({ line, bare = false, draft = null, status = null }: SchoolTaskLockedProps) {
  const t = useTranslations('SchoolLifecycle');
  const hasDraft = draft !== null && draft.trim() !== '';

  return (
    <div
      className={bare ? undefined : 'rounded-2xl border border-(--ssz-border-default) bg-(--ssz-bg-surface) px-5 py-4'}
      data-testid="school-task-locked"
    >
      {line !== undefined && line !== '' && (
        <p className="mb-3 text-[14px] leading-relaxed text-(--ssz-text-secondary)">{line}</p>
      )}
      <div className="flex items-start gap-2.5">
        <Lock className="mt-0.5 size-4 shrink-0 text-(--ssz-text-muted)" aria-hidden="true" />
        <div>
          <p className="text-[14px] font-semibold text-(--ssz-text-primary)">{t('errors.schoolNotActiveTitle')}</p>
          <p className="mt-0.5 text-[13px] text-(--ssz-text-muted)">{t('readOnly.learnerTask')}</p>
        </div>
      </div>
      {hasDraft && (
        <section className="mt-4" data-testid="school-task-locked-draft" aria-label={t('readOnly.draftHeading')}>
          <p className="mb-1.5 text-[12px] font-bold uppercase tracking-wide text-(--ssz-text-muted)">
            {t('readOnly.draftHeading')}
          </p>
          <div className="whitespace-pre-wrap break-words rounded-xl border border-(--ssz-border-default) bg-(--ssz-bg-base) px-4 py-3 text-[15px] leading-relaxed text-(--ssz-text-primary)">
            {draft}
          </div>
          <p className="mt-1.5 text-[13px] text-(--ssz-text-muted)">
            {status === 'closed' || status === 'purged' ? t('readOnly.draftClosed') : t('readOnly.draftSuspended')}
          </p>
        </section>
      )}
    </div>
  );
}

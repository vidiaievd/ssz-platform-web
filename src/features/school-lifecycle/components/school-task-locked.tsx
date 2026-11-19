'use client';

import { Lock } from 'lucide-react';
import { useTranslations } from 'next-intl';

/**
 * In place of a server-graded task while the course's school is suspended, closed or gone
 * (plan 90, live check, block 9). The engine would refuse the start and the hand-in anyway;
 * this keeps the learner from typing an answer nobody will take. The banner above the task
 * says why; tasks the browser grades itself stay open. `bare` — inside a practice stack,
 * whose task card already frames it.
 */
export function SchoolTaskLocked({ line, bare = false }: { line?: string; bare?: boolean }) {
  const t = useTranslations('SchoolLifecycle');

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
    </div>
  );
}

'use client';

import { useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';

import { Avatar } from '@/components/ui/avatar';

import type { ReviewSubmission } from '../../types';
import { AgeMark } from '../age-mark';

export interface SubmissionHeaderProps {
  submission: ReviewSubmission;
  /** Where this one sits in the queue as it is currently grouped and filtered. */
  position: { index: number; total: number } | null;
  /**
   * The reviewer was sent here by a verdict rather than by clicking. Focus follows, so
   * that the work being read aloud is the work now on screen.
   */
  takeFocus?: boolean;
  /** Called once focus has actually landed, so the flag that asked for it can be dropped. */
  onFocused?: () => void;
}

/**
 * The top of the review panel: where this work came from, who wrote it, how long ago.
 *
 * The order is the order the question is asked in. A teacher opening a submission is
 * orienting — which course, which lesson, whose work, which try — before they read a word
 * of it, and every one of those facts is here rather than inferable from the queue row
 * they clicked, because the panel is also its own page on a narrow screen.
 *
 * The path comes from the snapshot taken when the learner started, so it still reads after
 * the author has deleted the exercise (criterion 21); it is text and not a link for the
 * same reason.
 */
export function SubmissionHeader({
  submission,
  position,
  takeFocus = false,
  onFocused,
}: SubmissionHeaderProps) {
  const t = useTranslations('Review');
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (!takeFocus) return;
    heading.current?.focus();
    onFocused?.();
  }, [onFocused, takeFocus]);

  const path = [submission.exercise.path.course, submission.exercise.path.lesson]
    .filter(Boolean)
    .join(' › ');

  const facts = [
    submission.student.groupName,
    t.has(`type.${submission.exercise.type}` as 'type.short_answer')
      ? t(`type.${submission.exercise.type}` as 'type.short_answer')
      : submission.exercise.type,
    submission.attemptNo > 1 ? t('inbox.row.attempt', { n: submission.attemptNo }) : null,
  ].filter(Boolean);

  return (
    <header className="flex flex-col gap-3 border-b border-border px-5 pb-4 pt-5">
      <div className="flex min-w-0 items-baseline gap-2">
        <p className="min-w-0 truncate text-[11.5px] text-muted-foreground">{path}</p>
        {position === null ? null : (
          <span className="ml-auto shrink-0 text-[11.5px] font-semibold text-muted-foreground">
            {t('inbox.position', { i: position.index, n: position.total })}
          </span>
        )}
      </div>

      <div className="flex items-center gap-3">
        <Avatar name={submission.student.name ?? '?'} size="lg" className="size-10" aria-hidden />
        <div className="min-w-0 flex-1">
          {/* `tabIndex={-1}`: not in the tab order, but a legitimate focus target for the
              step after a verdict — the heading names the learner and the exercise, which
              is exactly what a reader needs to hear on arrival. */}
          <h1
            ref={heading}
            tabIndex={-1}
            className="truncate text-[17px] font-bold tracking-tight outline-none"
          >
            {submission.student.name ?? submission.student.id}
          </h1>
          <p className="truncate text-[12.5px] text-muted-foreground">{facts.join(' · ')}</p>
        </div>
        {submission.slaHours === null ? null : (
          <AgeMark
            className="shrink-0"
            hours={submission.ageHours}
            slaHours={submission.slaHours}
          />
        )}
      </div>

      <p className="truncate text-[14.5px] font-semibold">
        {submission.exercise.title ?? t('inbox.row.exerciseGone')}
      </p>
    </header>
  );
}

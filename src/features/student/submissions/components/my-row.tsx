'use client';

import { useId } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import { Check, ChevronRight, Clock, Undo2 } from 'lucide-react';

import { Link } from '@/lib/i18n/navigation';

import { useAgeWords } from '@/features/review/components/age-mark';
import { hoursSince } from '@/features/review/lib/age-scale';
import { cn } from '@/lib/utils';

import { resubmitModeFor, runnerHref } from '../lib/resubmit-route';
import type { MySubmission, MySubmissionStatus } from '../types';

import { ResubmitPanel } from './resubmit-panel';

/**
 * The three states a learner's submission can be in, and the colour each carries.
 *
 * Blue for waiting, amber for back, green for done — the same three the teacher's side
 * uses, so that one subsystem does not change its mind about what amber means halfway
 * between two screens (COMPONENTS §E).
 */
const STATUS_TONE: Record<MySubmissionStatus, string> = {
  pending: 'oklch(0.60 0.12 235)',
  returned: 'oklch(0.62 0.11 82)',
  approved: 'oklch(0.55 0.12 145)',
};

const STATUS_ICON = { pending: Clock, returned: Undo2, approved: Check } as const;

export interface MyRowProps {
  submission: MySubmission;
  open: boolean;
  onToggle: () => void;
  /**
   * Off inside a lesson group, where the heading above already carries the course and the
   * lesson — repeating them on every row is the twelve-identical-lines list §E asks to
   * stop making.
   */
  showPath?: boolean;
}

/**
 * One submission, and everything the learner is owed about it.
 *
 * Collapsed it answers "was it looked at"; open it answers "what did they say". A returned
 * one opens itself, because a comment that must be found is a comment that goes unread —
 * the whole point of putting the teacher's words here rather than only in a notification
 * (criterion 39).
 *
 * The tinting is `color-mix` over the surface rather than the flat amber of the mockup:
 * the design names one value for a light page, and this component renders on a dark one
 * too, where a fixed near-white would be a hole cut in the screen.
 */
export function MyRow({ submission, open, onToggle, showPath = true }: MyRowProps) {
  const t = useTranslations('Review.student');
  const format = useFormatter();
  const { words } = useAgeWords();

  const tone = STATUS_TONE[submission.status];
  const Icon = STATUS_ICON[submission.status];
  const returned = submission.status === 'returned';
  const bodyId = useId();

  const teacher = submission.decision?.teacherName ?? null;
  const decidedAt = submission.decision
    ? format.relativeTime(new Date(submission.decision.at))
    : null;

  return (
    <div
      className="overflow-hidden rounded-[13px] border-[1.5px]"
      style={{
        borderColor: returned
          ? `color-mix(in oklch, ${tone} 45%, var(--ssz-border-default))`
          : 'var(--ssz-border-default)',
        background: returned
          ? `color-mix(in oklch, ${tone} 7%, var(--ssz-bg-surface))`
          : 'var(--ssz-bg-surface)',
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={bodyId}
        className="flex w-full items-center gap-3.5 px-4 py-3.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
      >
        <span
          aria-hidden
          className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[10px]"
          style={{ background: `color-mix(in oklch, ${tone} 12%, transparent)`, color: tone }}
        >
          <Icon size={17} />
        </span>

        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">
            {submission.exerciseTitle ?? t('row.attempt', { n: submission.attemptNo })}
          </span>
          {showPath && (submission.course !== null || submission.lesson !== null) && (
            <span className="mt-px block truncate text-xs text-(--ssz-text-secondary)">
              {[submission.course, submission.lesson].filter(Boolean).join(' · ')}
            </span>
          )}
        </span>

        <span className="shrink-0 text-right">
          {/*
            The state in words beside the colour, never instead of it — the same rule the
            teacher's queue holds itself to, and the one thing a reader who does not see
            the tint has to go on.
          */}
          <span className="block text-[12.5px] font-semibold" style={{ color: tone }}>
            {t(`status.${submission.status}`)}
          </span>
          <span className="mt-px block text-[11.5px] text-(--ssz-text-muted)">
            {submission.status === 'pending'
              ? submission.expectedResponseBy === null
                ? t('due.unknown')
                : t('due.expected', {
                    when: format.relativeTime(new Date(submission.expectedResponseBy)),
                  })
              : teacher === null
                ? t('row.unsigned', { when: decidedAt ?? '' })
                : t('row.signed', { teacher, when: decidedAt ?? '' })}
          </span>
        </span>

        <ChevronRight
          aria-hidden
          size={16}
          className={cn(
            'shrink-0 text-(--ssz-text-muted) motion-safe:transition-transform',
            open && 'rotate-90',
          )}
        />
      </button>

      {open && (
        <div id={bodyId} className="flex flex-col gap-3 pb-4 pl-[63px] pr-4">
          {submission.status === 'pending' && (
            <div className="text-[13px] leading-relaxed text-(--ssz-text-secondary)">
              <p>{t('pending.body', { age: words(hoursSince(submission.submittedAt)) })}</p>
              {/*
                Invariant 2: waiting without a date reads as lost. And where a date exists,
                it is said to be the usual time rather than a countdown — a school that
                answers in a day and a half has not broken a promise at hour 25.
              */}
              <p className="mt-1.5 text-(--ssz-text-muted)">{t('due.note')}</p>
            </div>
          )}

          {submission.decision?.comment != null && submission.decision.comment !== '' && (
            <div className="rounded-[11px] border-[1.5px] border-(--ssz-border-default) bg-(--ssz-bg-surface) px-3.5 py-3">
              <div className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.07em] text-(--ssz-text-muted)">
                {teacher === null ? t('comment.unsigned') : t('comment.label', { teacher })}
              </div>
              <p
                className="text-[14.5px] leading-relaxed"
                style={{ fontFamily: 'var(--ssz-font-reading)' }}
              >
                {submission.decision.comment}
              </p>
            </div>
          )}

          {/*
            Criterion 40: a pass with nothing written on it is still something a person
            decided, and an empty card would read as "nobody got to it yet" — which is the
            exact confusion this whole screen exists to end.
          */}
          {submission.status === 'approved' && !submission.decision?.comment && (
            <p className="text-[13px] text-(--ssz-text-secondary)">{t('approved.noComment')}</p>
          )}

          {/*
            The way back into the work, beside the words that sent it back (criterion 39).

            Which way that is depends on the exercise, not on the layout: an essay is one
            block of text and is rewritten right here, under the comment; anything with
            items, a self-check or a keyboard pad of its own belongs in the runner it was
            typed in, and goes there with the comment carried above the task.

            `canResubmit` is the engine's answer to "would another go resume *this* row" —
            an older returned attempt that a later one already superseded gets the note
            instead of the button, because the button would quietly resume the newer one.
          */}
          {returned &&
            (submission.canResubmit ? (
              resubmitModeFor(submission.exerciseType) === 'in-place' ? (
                <ResubmitPanel submission={submission} />
              ) : (
                <div className="flex flex-col gap-1.5">
                  <Link
                    href={runnerHref(submission)}
                    className="inline-flex items-center self-start rounded-[10px] bg-(--ssz-color-primary-500) px-4 py-2 text-[13px] font-bold text-white transition-colors hover:bg-(--ssz-color-primary-600) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ssz-border-focus)"
                  >
                    {t('redo.again')}
                  </Link>
                  <p className="text-[12.5px] text-(--ssz-text-secondary)">{t('returned.hint')}</p>
                </div>
              )
            ) : (
              <p className="text-[12.5px] text-(--ssz-text-secondary)">
                {t('returned.superseded')}
              </p>
            ))}
        </div>
      )}
    </div>
  );
}

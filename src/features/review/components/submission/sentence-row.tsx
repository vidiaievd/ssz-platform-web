'use client';

import { useState } from 'react';
import { AlertTriangle, Ban, Check, ChevronRight, CircleAlert, Info } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { DiffLine, VerdictChip } from '@/features/content-authoring/components/translate/tr-marks';
import {
  VerdictPill,
  type VerdictTone,
} from '@/features/content-authoring/components/verdict-pill';
import type { Verdict as ErrorCorrectionVerdict } from '@/lib/shared-kernel/error-correction';
import type {
  ErrorCorrectionItemDetail,
  ErrorCorrectionSpanDetail,
  ReviewItemDetail,
  TranslateItemDetail,
} from '@/features/content-authoring/types/review';

import { SentenceComment } from './comment-box';

const READING = 'var(--ssz-font-reading)';

/** Error correction's own vocabulary, toned to read the same as translate's. */
const EC_VERDICT_TONE: Record<ErrorCorrectionVerdict, VerdictTone> = {
  exact: 'ok',
  typo: 'warn',
  partial: 'warn',
  stray: 'warn',
  off: 'bad',
  empty: 'muted',
  noref: 'muted',
};

/** Structural rather than by template code: an item is read by what its details carry. */
export const isTranslateDetail = (detail: ReviewItemDetail): detail is TranslateItemDetail =>
  'tokens' in detail;
export const isErrorCorrectionDetail = (
  detail: ReviewItemDetail,
): detail is ErrorCorrectionItemDetail => 'spans' in detail;

/** What a sentence the machine closed reads as, on its one collapsed line. */
const closedLine = (detail: ReviewItemDetail): string =>
  isTranslateDetail(detail) ? detail.submitted : detail.built;

export interface SentenceRowProps {
  detail: ReviewItemDetail;
  index: number;
  /** The sentence as its author wrote it, where the exercise could still be read. */
  prompt?: string;
  teacherNote?: string;
  comment: string | undefined;
  onComment: (value: string | undefined) => void;
}

/**
 * One sentence, in one of its two states.
 *
 * A sentence the machine closed against the key is a line with a tick: there is nothing
 * to decide about it, and twenty of them opened up is how the three that need reading get
 * scrolled past. It still opens on a click — "the machine says this is fine" is a claim a
 * teacher is entitled to check.
 *
 * Everything else opens with the whole analysis: what came back, the diff against the
 * closest accepted answer, the key itself, the author's note for the teacher, and the
 * guards the answer tripped. None of those four was invented by the machine, which is why
 * they are shown rather than summarised into a score.
 */
export function SentenceRow({
  detail,
  index,
  prompt,
  teacherNote,
  comment,
  onComment,
}: SentenceRowProps) {
  const t = useTranslations('Review.submission.sentence');
  const autoPassed = detail.routing === 'pass';
  const [open, setOpen] = useState(!autoPassed);

  if (autoPassed && !open) {
    return (
      <li>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex w-full items-center gap-2 rounded-[9px] px-3 py-2 text-left hover:bg-(--ssz-bg-subtle)"
        >
          <Check aria-hidden className="h-3.5 w-3.5 shrink-0 text-success-700" />
          <span className="min-w-0 flex-1 truncate text-[13px]" style={{ fontFamily: READING }}>
            {closedLine(detail)}
          </span>
          <span className="shrink-0 text-[11px] text-muted-foreground">{t('autoPassed')}</span>
          <ChevronRight aria-hidden className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        </button>
      </li>
    );
  }

  return (
    <li
      className="overflow-hidden rounded-[11px] border-[1.5px]"
      // Amber only where a person still has to read it: the border is what separates the
      // sentences that are this teacher's work from the ones already settled.
      style={{ borderColor: autoPassed ? 'var(--color-border)' : 'oklch(0.86 0.05 82)' }}
    >
      <div className="flex items-center gap-2 bg-(--ssz-bg-subtle) px-3 py-2">
        <span
          className="shrink-0 text-[11px] text-muted-foreground"
          style={{ fontFamily: 'var(--ssz-font-mono)' }}
        >
          {String(index).padStart(2, '0')}
        </span>
        {prompt === undefined ? null : (
          <span className="min-w-0 flex-1 truncate text-[14.5px]" style={{ fontFamily: READING }}>
            {prompt}
          </span>
        )}
        <span className="ml-auto flex shrink-0 items-center gap-2">
          <ItemVerdict detail={detail} />
          {autoPassed ? (
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-[11px] font-semibold text-muted-foreground hover:text-foreground"
            >
              {t('collapse')}
            </button>
          ) : null}
        </span>
      </div>

      <div className="flex flex-col gap-2 px-3 py-3">
        {isTranslateDetail(detail) ? (
          <TranslateBody detail={detail} />
        ) : isErrorCorrectionDetail(detail) ? (
          <ErrorCorrectionBody detail={detail} />
        ) : null}

        {/* Only ever seen by the teacher, which is why it lives here and not with the key. */}
        {teacherNote === undefined || teacherNote.trim() === '' ? null : (
          <p
            className="flex items-start gap-2 border-l-[2.5px] border-warning-300 pl-2.5 text-[12.5px] italic text-(--ssz-text-secondary)"
            style={{ fontFamily: READING }}
          >
            <Info aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0 not-italic" />
            {teacherNote}
          </p>
        )}

        <SentenceComment value={comment} onChange={onComment} />
      </div>
    </li>
  );
}

/** The verdict, worded in the vocabulary of whichever template produced the item. */
function ItemVerdict({ detail }: { detail: ReviewItemDetail }) {
  const t = useTranslations('Authoring');

  if (isTranslateDetail(detail)) return <VerdictChip verdict={detail.verdict} />;
  if (!isErrorCorrectionDetail(detail)) return null;

  return (
    <VerdictPill tone={EC_VERDICT_TONE[detail.verdict]}>
      {t(`errorCorrection.verdict.${detail.verdict}` as 'errorCorrection.verdict.exact')}
    </VerdictPill>
  );
}

/** What came back, against the closest accepted translation. */
function TranslateBody({ detail }: { detail: TranslateItemDetail }) {
  const t = useTranslations('Review.submission.sentence');
  const tAuthoring = useTranslations('Authoring');

  return (
    <>
      <p className="text-[14.5px] leading-relaxed" style={{ fontFamily: READING }}>
        {detail.submitted === '' ? t('blank') : detail.submitted}
      </p>

      {/* The key's own words, unmasked: the masking is the learner's projection, and
          seeing the divergence is the whole point of this screen. */}
      {detail.tokens.length > 0 && <DiffLine tokens={detail.tokens} />}

      <p className="text-[12px] text-muted-foreground">{t('against', { ref: detail.ref })}</p>

      {detail.missing.map((guard, position) => (
        <p
          key={`m${position}`}
          className="flex items-start gap-2 text-[12px] text-warning-700 dark:text-warning-300"
        >
          <CircleAlert aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span style={{ fontFamily: 'var(--ssz-font-mono)' }}>
            {tAuthoring('translate.tester.requireMissed', { text: guard.text })}
            {guard.note !== undefined && guard.note !== '' ? ` — ${guard.note}` : ''}
          </span>
        </p>
      ))}
      {detail.banned.map((guard, position) => (
        <p
          key={`b${position}`}
          className="flex items-start gap-2 text-[12px] text-error-700 dark:text-error-300"
        >
          <Ban aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span style={{ fontFamily: 'var(--ssz-font-mono)' }}>
            {tAuthoring('translate.tester.forbidHit', { text: guard.text })}
            {guard.note !== undefined && guard.note !== '' ? ` — ${guard.note}` : ''}
          </span>
        </p>
      ))}
    </>
  );
}

/**
 * The sentence the learner's edits produced, and the planted mistakes one by one.
 *
 * Mistake by mistake rather than as a diff against the key, because that is the question
 * being marked: a learner who repaired two of three mistakes has not written a worse
 * sentence, they have missed one thing, and the teacher needs to see which.
 */
function ErrorCorrectionBody({ detail }: { detail: ErrorCorrectionItemDetail }) {
  const t = useTranslations('Review.submission.sentence');
  const tAuthoring = useTranslations('Authoring');

  return (
    <>
      <p className="text-[14.5px] leading-relaxed" style={{ fontFamily: READING }}>
        {detail.built.trim() === '' ? t('blank') : detail.built}
      </p>

      <p className="text-[12px] text-muted-foreground">
        {tAuthoring('review.ecFixed', { fixed: detail.fixedSpans, total: detail.totalSpans })}
      </p>

      {detail.spans.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {detail.spans.map((span) => (
            <SpanRow key={span.key} span={span} />
          ))}
        </ul>
      )}

      {detail.stray.length > 0 && (
        <p className="flex items-start gap-2 text-[12px] text-warning-700 dark:text-warning-300">
          <AlertTriangle aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {tAuthoring('review.ecStray', {
            words: detail.stray.map((edit) => `«${edit.word === '' ? '…' : edit.word}»`).join(', '),
          })}
        </p>
      )}
    </>
  );
}

/** One planted mistake: what was wrong, what the key wants, and what the learner put. */
function SpanRow({ span }: { span: ErrorCorrectionSpanDetail }) {
  const t = useTranslations('Authoring');
  const reached = span.state === 'fixed';

  return (
    <li className="flex flex-col gap-0.5 rounded-[9px] border border-border px-2.5 py-1.5">
      <div className="flex flex-wrap items-center gap-2 text-[13.5px]">
        {reached ? (
          <Check aria-hidden className="h-3.5 w-3.5 shrink-0 text-success-700" />
        ) : (
          <CircleAlert aria-hidden className="h-3.5 w-3.5 shrink-0 text-warning-700" />
        )}
        <span className="text-[11px] uppercase text-muted-foreground">
          {t(`errorCorrection.spanType.${span.type}` as 'errorCorrection.spanType.order')}
        </span>
        <span style={{ fontFamily: READING }} className="line-through opacity-70">
          {span.wrong === '' ? '…' : span.wrong}
        </span>
        <span aria-hidden>→</span>
        <span style={{ fontFamily: READING }} className="font-semibold">
          {span.fix === '' ? '…' : span.fix}
        </span>
      </div>

      <p className="text-[12px] text-muted-foreground">
        {span.submitted.trim() === ''
          ? t('review.ecSpanUntouched')
          : t('review.ecSpanSubmitted', { text: span.submitted })}
      </p>

      {span.note.trim() === '' ? null : (
        <p className="flex items-start gap-2 text-[12px] text-(--ssz-text-secondary)">
          <Info aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {span.note}
        </p>
      )}
    </li>
  );
}

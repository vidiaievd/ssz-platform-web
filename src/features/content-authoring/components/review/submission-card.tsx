'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { AlertTriangle, Ban, Check, CircleAlert, Info, Undo2, User } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import { useReviewAttempt } from '@/features/content-authoring/api';
import type { Verdict as EcVerdict } from '@/lib/shared-kernel/error-correction';
import type {
  ErrorCorrectionItemDetail,
  ErrorCorrectionSpanDetail,
  ReviewDecision,
  ReviewItemDetail,
  ReviewQueueEntry,
  TranslateItemDetail,
} from '@/features/content-authoring/types/review';

import { DiffLine, DiffLegend, VerdictChip } from '../translate/tr-marks';
import { VerdictPill, type VerdictTone } from '../verdict-pill';

const READING = 'var(--ssz-font-reading)';

/**
 * Nearly-right first. The order is the teacher's working order: a `typo` is a decision
 * that takes a second, an `off` is one that takes reading — and a queue that opens with
 * the hardest sentence is a queue that gets abandoned halfway.
 *
 * One table for both vocabularies: translate never produces `partial` or `stray`, error
 * correction never produces `near`, and a queue that mixed templates would still sort.
 */
const VERDICT_ORDER: Record<string, number> = {
  typo: 0,
  near: 1,
  partial: 2,
  stray: 3,
  exact: 4,
  off: 5,
  empty: 6,
  noref: 7,
};

const verdictRank = (verdict: string): number => VERDICT_ORDER[verdict] ?? 99;

/** Error correction's own vocabulary, toned to read the same as translate's. */
const EC_VERDICT_TONE: Record<EcVerdict, VerdictTone> = {
  exact: 'ok',
  typo: 'warn',
  partial: 'warn',
  stray: 'warn',
  off: 'bad',
  empty: 'muted',
  noref: 'muted',
};

/** A sentence as its author wrote it, reduced to what the queue shows of it. */
export interface AuthoredItem {
  /** What the learner was given: the source sentence, or the faulty one to repair. */
  prompt: string;
  /** Only ever shown here — never to the learner. */
  teacherNote?: string;
}

/** Structural, not by template code: an entry whose template this card does not know
 *  still renders whichever reading its details carry. */
const isTranslateDetail = (detail: ReviewItemDetail): detail is TranslateItemDetail =>
  'tokens' in detail;
const isErrorCorrectionDetail = (
  detail: ReviewItemDetail,
): detail is ErrorCorrectionItemDetail => 'spans' in detail;

/** What a sentence closed by the check reads as, in the collapsed line. */
const closedLine = (detail: ReviewItemDetail): string =>
  isTranslateDetail(detail) ? detail.submitted : detail.built;

export interface SubmissionCardProps {
  exerciseId: string;
  entry: ReviewQueueEntry;
  /** The sentences as their author wrote them, by id. Empty for templates not yet read. */
  itemsById: Map<string, AuthoredItem>;
}

/**
 * One submission, and the three things a teacher can do about it.
 *
 * Sentences the machine closed are collapsed to a line: they matched a variant of the key,
 * there is nothing to decide, and making a teacher scroll past them is how the ones that
 * do need reading get missed. Everything else opens with the diff, the author's own notes
 * and the guards the answer tripped — the three levels of error analysis this template
 * rests on, none of which the machine invented.
 *
 * Approving is not a single click by design: each open sentence is decided, and the score
 * follows from those decisions on the server. `Send tilbake` needs none of them — it is
 * the teacher saying "look at this again", and it carries a comment instead of a mark.
 */
export function SubmissionCard({ exerciseId, entry, itemsById }: SubmissionCardProps) {
  const t = useTranslations('Authoring');
  const review = useReviewAttempt(exerciseId);

  const details = entry.details;
  const all = details?.items ?? [];
  const closed = all.filter((item) => item.routing === 'pass');
  const open = [...all.filter((item) => item.routing !== 'pass')].sort(
    (a, b) => verdictRank(a.verdict) - verdictRank(b.verdict),
  );

  /** What the teacher has decided so far, by item. Undecided is not approved. */
  const [decisions, setDecisions] = useState<Record<string, ReviewDecision>>({});
  const [comment, setComment] = useState('');

  const decide = (itemId: string, patch: Partial<ReviewDecision>) =>
    setDecisions((current) => ({
      ...current,
      [itemId]: { itemId, approved: false, ...current[itemId], ...patch },
    }));

  const decidedCount = open.filter((item) => decisions[item.itemId] !== undefined).length;

  return (
    <article className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4">
      <header className="flex flex-wrap items-center gap-2 border-b border-border pb-2">
        <span className="flex size-8 items-center justify-center rounded-full bg-[var(--ssz-bg-subtle)] text-xs font-semibold">
          <User className="size-4" aria-hidden />
        </span>
        <span>
          <span className="block text-sm font-medium">
            {t('review.learner', { id: entry.userId.slice(0, 8) })}
          </span>
          <span className="block text-xs text-muted-foreground">
            {entry.submittedAt === null
              ? t('review.notSubmitted')
              : new Date(entry.submittedAt).toLocaleString()}
          </span>
        </span>
        <span className="flex-1" />
        <span className="text-xs text-muted-foreground">
          {details === null
            ? t('review.unreadable')
            : t('review.summary', { auto: closed.length, manual: open.length })}
        </span>
      </header>

      {closed.length > 0 && (
        <ul className="flex flex-col gap-1">
          {closed.map((item) => (
            <li key={item.itemId} className="flex flex-wrap items-center gap-2 text-sm">
              <Check className="size-3.5 text-success-700" aria-hidden />
              <span style={{ fontFamily: READING }}>{closedLine(item)}</span>
              <span className="flex-1" />
              <ItemVerdictChip detail={item} />
            </li>
          ))}
        </ul>
      )}

      {open.some(isTranslateDetail) && <DiffLegend />}

      <ul className="flex flex-col gap-4">
        {open.map((item) => (
          <li key={item.itemId} className="border-t border-border pt-3">
            <OpenItem
              detail={item}
              authored={itemsById.get(item.itemId)}
              decision={decisions[item.itemId]}
              onDecide={(patch) => decide(item.itemId, patch)}
            />
          </li>
        ))}
      </ul>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium" htmlFor={`review-comment-${entry.attemptId}`}>
          {t('review.commentLabel')}
        </label>
        <Textarea
          id={`review-comment-${entry.attemptId}`}
          rows={2}
          value={comment}
          placeholder={t('review.commentPlaceholder')}
          onChange={(event) => setComment(event.target.value)}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          disabled={review.isPending}
          onClick={() =>
            review.mutate({
              attemptId: entry.attemptId,
              outcome: 'approved',
              decisions: Object.values(decisions),
              comment: comment.trim() === '' ? undefined : comment.trim(),
            })
          }
        >
          <Check className="size-4" aria-hidden />
          {t('review.finish')}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={review.isPending}
          onClick={() =>
            review.mutate({
              attemptId: entry.attemptId,
              outcome: 'returned',
              decisions: Object.values(decisions),
              comment: comment.trim() === '' ? undefined : comment.trim(),
            })
          }
        >
          <Undo2 className="size-4" aria-hidden />
          {t('review.sendBack')}
        </Button>
        <span className="text-xs text-muted-foreground">
          {open.length === 0
            ? t('review.nothingOpen')
            : t('review.decided', { decided: decidedCount, total: open.length })}
        </span>
      </div>

      {review.isError && (
        <p className="text-xs text-error" role="status">
          {t('review.failed')}
        </p>
      )}
    </article>
  );
}

interface OpenItemProps {
  detail: ReviewItemDetail;
  /** The sentence as its author wrote it, when the exercise could be read. */
  authored: AuthoredItem | undefined;
  decision: ReviewDecision | undefined;
  onDecide: (patch: Partial<ReviewDecision>) => void;
}

/**
 * One sentence a person has to judge.
 *
 * The frame is the same whatever the template — verdict, what was asked, what came back,
 * the author's note for the teacher, and the decision — because the teacher's act is the
 * same. Only the middle differs, and it differs in what the question even is: translate
 * asks "is this an acceptable translation the key missed?", error correction asks "did
 * they find the mistakes?". Those are two readings, not two stylings of one.
 */
function OpenItem({ detail, authored, decision, onDecide }: OpenItemProps) {
  const t = useTranslations('Authoring');
  const approved = decision?.approved === true;
  const rejected = decision !== undefined && !decision.approved;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <ItemVerdictChip detail={detail} />
        <span className="text-[11px] text-muted-foreground">
          {t('review.similarity', { percent: Math.round(detail.similarity * 100) })}
        </span>
      </div>

      {authored !== undefined && (
        <p className="text-xs text-muted-foreground" style={{ fontFamily: READING }}>
          {authored.prompt}
        </p>
      )}

      {isTranslateDetail(detail) ? (
        <TranslateBody detail={detail} />
      ) : isErrorCorrectionDetail(detail) ? (
        <ErrorCorrectionBody detail={detail} />
      ) : null}

      {/* Only the teacher ever sees this one, which is why it is here and not with the key. */}
      {authored?.teacherNote !== undefined && authored.teacherNote.trim() !== '' && (
        <p className="flex items-start gap-2 text-xs text-[var(--ssz-text-secondary)]">
          <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          {authored.teacherNote}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant={approved ? 'primary' : 'outline'}
          onClick={() => onDecide({ approved: true })}
        >
          <Check className="size-3.5" aria-hidden />
          {t('review.itemApprove')}
        </Button>
        <Button
          type="button"
          size="sm"
          variant={rejected ? 'danger' : 'outline'}
          onClick={() => onDecide({ approved: false })}
        >
          {t('review.itemReject')}
        </Button>
        <Input
          className="min-w-40 flex-1"
          value={decision?.comment ?? ''}
          aria-label={t('review.itemCommentLabel')}
          placeholder={t('review.itemCommentPlaceholder')}
          onChange={(event) => onDecide({ comment: event.target.value })}
        />
      </div>
    </div>
  );
}

/** The verdict, worded in the vocabulary of whichever template produced the item. */
function ItemVerdictChip({ detail }: { detail: ReviewItemDetail }) {
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
  const t = useTranslations('Authoring');

  return (
    <>
      <p className="text-sm" style={{ fontFamily: READING }}>
        {detail.submitted === '' ? t('review.blankAnswer') : detail.submitted}
      </p>

      {/* The diff carries the key's own words unmasked — the masking is the learner's
          projection, and the point of this screen is to see the divergence. */}
      {detail.tokens.length > 0 && <DiffLine tokens={detail.tokens} />}

      <p className="text-xs text-muted-foreground">{t('review.against', { ref: detail.ref })}</p>

      {detail.missing.map((guard, index) => (
        <p key={`m${index}`} className="flex items-start gap-2 text-xs text-warning-700">
          <CircleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <span>
            {t('translate.tester.requireMissed', { text: guard.text })}
            {guard.note !== undefined && guard.note !== '' && ` — ${guard.note}`}
          </span>
        </p>
      ))}
      {detail.banned.map((guard, index) => (
        <p key={`b${index}`} className="flex items-start gap-2 text-xs text-error">
          <Ban className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <span>
            {t('translate.tester.forbidHit', { text: guard.text })}
            {guard.note !== undefined && guard.note !== '' && ` — ${guard.note}`}
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
 * being marked: a learner who repaired two of three mistakes and left the third has not
 * written a worse sentence, they have missed one thing, and a teacher needs to see which.
 * The author's own note on a mistake sits with it — it is the only explanation on this
 * screen nobody invented.
 */
function ErrorCorrectionBody({ detail }: { detail: ErrorCorrectionItemDetail }) {
  const t = useTranslations('Authoring');

  return (
    <>
      <p className="text-sm" style={{ fontFamily: READING }}>
        {detail.built.trim() === '' ? t('review.blankAnswer') : detail.built}
      </p>

      <p className="text-xs text-muted-foreground">
        {t('review.ecFixed', { fixed: detail.fixedSpans, total: detail.totalSpans })}
      </p>

      {detail.spans.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {detail.spans.map((span) => (
            <SpanRow key={span.key} span={span} />
          ))}
        </ul>
      )}

      {detail.stray.length > 0 && (
        <p className="flex items-start gap-2 text-xs text-warning-700">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          {t('review.ecStray', {
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
    <li className="flex flex-col gap-0.5 rounded-md border border-border px-2 py-1.5">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        {reached ? (
          <Check className="size-3.5 shrink-0 text-success-700" aria-hidden />
        ) : (
          <CircleAlert className="size-3.5 shrink-0 text-warning-700" aria-hidden />
        )}
        <span className="text-[11px] text-muted-foreground uppercase">
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

      <p className="text-xs text-muted-foreground">
        {span.submitted.trim() === ''
          ? t('review.ecSpanUntouched')
          : t('review.ecSpanSubmitted', { text: span.submitted })}
      </p>

      {span.note.trim() !== '' && (
        <p className="flex items-start gap-2 text-xs text-[var(--ssz-text-secondary)]">
          <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          {span.note}
        </p>
      )}
    </li>
  );
}

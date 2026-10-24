'use client';

import { useId, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

import { useAiReview, useDisputeAiReview } from '../api/use-ai-review';
import type { AiReviewMark, AiReviewRemark } from '../types';

const READING = 'var(--ssz-font-reading)';

/** As long as the engine takes it. */
const REASON_MAX = 1000;

/** The aspects the messages name; anything newer reads under its own code. */
const KNOWN_ASPECTS = [
  'grammar',
  'order',
  'lexis',
  'register',
  'meaning',
  'alternative',
  'task',
  'structure',
  'content',
] as const;

type T = ReturnType<typeof useTranslations<'Review.aiReview'>>;

export interface AiReviewPanelProps {
  exerciseId: string;
  attemptId: string;
  /** What the items are called: sentences, questions, or one essay text. */
  templateCode: string;
  /**
   * Off where the screen already shows the summary — it is also the attempt's comment, and
   * a card that says it twice reads as two reviewers.
   */
  showSummary?: boolean;
}

/**
 * A model's review of the learner's work, and their one way to say it is wrong
 * (plan 79, step 2.3c).
 *
 * The label comes first and comes always — before the review loads, if it fails to load, and
 * with no way to close it: a learner must never read a model's words as a teacher's (§2.1).
 * The remarks follow the order of the work, item by item, then the marks of an essay with
 * the reason for each. «This review is wrong» is offered once; the verdict does not change,
 * and the screen says so rather than letting the button look like an appeal.
 */
export function AiReviewPanel({
  exerciseId,
  attemptId,
  templateCode,
  showSummary = true,
}: AiReviewPanelProps) {
  const t = useTranslations('Review.aiReview');
  const review = useAiReview(exerciseId, attemptId);

  return (
    <section
      aria-label={t('label')}
      className="flex flex-col gap-3 rounded-[11px] border-[1.5px] border-dashed border-(--ssz-border-strong) bg-(--ssz-bg-surface) px-3.5 py-3"
    >
      <header>
        <p className="flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-[0.07em] text-(--ssz-text-accent)">
          <Sparkles aria-hidden className="h-3.5 w-3.5 shrink-0" />
          {t('label')}
        </p>
        <p className="mt-1 text-[12.5px] text-(--ssz-text-secondary)">{t('caveat')}</p>
      </header>

      {review.isPending ? (
        <Skeleton className="h-16 w-full" />
      ) : review.isError ? (
        <p className="text-[12.5px] text-(--ssz-feedback-no-fg)">
          {t('failed')}{' '}
          <button
            type="button"
            onClick={() => void review.refetch()}
            className="font-semibold underline underline-offset-2"
          >
            {t('retry')}
          </button>
        </p>
      ) : review.data === null ? null : (
        <>
          {showSummary && review.data.summary !== null && review.data.summary.trim() !== '' && (
            <p className="text-[14.5px] leading-relaxed" style={{ fontFamily: READING }}>
              {review.data.summary}
            </p>
          )}

          <Remarks t={t} items={review.data.items} templateCode={templateCode} />

          {review.data.marks !== null && review.data.marks.length > 0 && (
            <Marks t={t} marks={review.data.marks} />
          )}

          <Dispute
            exerciseId={exerciseId}
            attemptId={attemptId}
            disputedAt={review.data.disputedAt}
          />
        </>
      )}
    </section>
  );
}

/** The remarks, grouped under the item they are about, in the order of the work. */
function Remarks({
  t,
  items,
  templateCode,
}: {
  t: T;
  items: AiReviewRemark[];
  templateCode: string;
}) {
  if (items.length === 0) {
    return <p className="text-[13px] text-(--ssz-text-secondary)">{t('noRemarks')}</p>;
  }

  const groups = new Map<number, AiReviewRemark[]>();
  for (const item of [...items].sort((a, b) => a.sentenceIndex - b.sentenceIndex)) {
    const group = groups.get(item.sentenceIndex) ?? [];
    group.push(item);
    groups.set(item.sentenceIndex, group);
  }
  const essay = templateCode === 'writing_task';

  return (
    <div className="flex flex-col gap-2.5">
      {[...groups].map(([index, remarks]) => (
        <div key={index} className="flex flex-col gap-1.5">
          {!essay && (
            <p className="text-[11px] font-bold uppercase tracking-[0.07em] text-(--ssz-text-muted)">
              {templateCode === 'short_answer'
                ? t('question', { n: index + 1 })
                : t('sentence', { n: index + 1 })}
            </p>
          )}
          {remarks.map((remark, i) => (
            <Remark key={`${remark.itemId}-${i}`} t={t} remark={remark} essay={essay} />
          ))}
        </div>
      ))}
    </div>
  );
}

function Remark({ t, remark, essay }: { t: T; remark: AiReviewRemark; essay: boolean }) {
  return (
    <div className="flex flex-col gap-1 rounded-[9px] bg-(--ssz-bg-surface-subtle) px-3 py-2">
      <p className="text-[11px] uppercase tracking-wide text-(--ssz-text-muted)">
        {aspectLabel(t, remark.aspect)}
        {remark.fragment === null && (
          <>
            {' · '}
            {essay ? t('wholeText') : t('wholeAnswer')}
          </>
        )}
      </p>
      {remark.fragment !== null && (
        <p className="text-[13.5px] leading-relaxed" style={{ fontFamily: READING }}>
          <span className="rounded bg-warning-100 px-1 dark:bg-warning-500/20">
            {remark.fragment}
          </span>
          {remark.suggestion !== null && remark.suggestion.trim() !== '' && (
            <>
              {' → '}
              <span className="font-semibold">{remark.suggestion}</span>
            </>
          )}
        </p>
      )}
      <p className="text-[13px] leading-relaxed text-(--ssz-text-primary)">{remark.comment}</p>
    </div>
  );
}

/** An essay's marks, in rubric order (the BFF sorts and names them), each with its reason. */
function Marks({ t, marks }: { t: T; marks: AiReviewMark[] }) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-[11px] font-bold uppercase tracking-[0.07em] text-(--ssz-text-muted)">
        {t('marksTitle')}
      </p>
      <ul className="flex flex-col gap-1.5">
        {marks.map((mark) => (
          <li key={mark.criterionId} className="text-[13px] leading-relaxed">
            <span className="font-semibold">
              {mark.criterionName?.trim() ? mark.criterionName : t('unnamed')}
            </span>
            {' · '}
            <span className="tabular-nums">{t('mark', { mark: mark.mark })}</span>
            <span className="block text-(--ssz-text-secondary)">{mark.reason}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * «This review is wrong». A button, then an optional reason, then a thank-you that stays:
 * the engine counts one dispute per review, and the screen remembers it the same way.
 */
function Dispute({
  exerciseId,
  attemptId,
  disputedAt,
}: {
  exerciseId: string;
  attemptId: string;
  disputedAt: string | null;
}) {
  const t = useTranslations('Review.aiReview');
  const format = useFormatter();
  const dispute = useDisputeAiReview(exerciseId, attemptId);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const fieldId = useId();

  if (disputedAt !== null) {
    return (
      <p className="text-[12.5px] text-(--ssz-text-secondary)">
        {t('disputed', { when: format.relativeTime(new Date(disputedAt)) })}
      </p>
    );
  }

  if (!open) {
    return (
      <div>
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(true)}>
          {t('dispute')}
        </Button>
      </div>
    );
  }

  const send = () => {
    const trimmed = reason.trim();
    dispute.mutate(trimmed === '' ? {} : { reason: trimmed });
  };

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={fieldId} className="text-[12.5px] font-semibold">
        {t('reasonLabel')}
      </label>
      <textarea
        id={fieldId}
        value={reason}
        maxLength={REASON_MAX}
        rows={3}
        onChange={(event) => setReason(event.target.value)}
        placeholder={t('reasonPlaceholder')}
        className="w-full rounded-[9px] border-[1.5px] border-(--ssz-border-default) bg-(--ssz-bg-surface) px-3 py-2 text-[13.5px] outline-none focus-visible:border-(--ssz-border-focus)"
      />
      <p className="text-[12px] text-(--ssz-text-muted)">{t('disputeNote')}</p>
      <div className="flex flex-wrap items-center gap-1.5">
        <Button type="button" size="sm" disabled={dispute.isPending} onClick={send}>
          {dispute.isPending ? t('sending') : t('send')}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={dispute.isPending}
          onClick={() => setOpen(false)}
        >
          {t('cancel')}
        </Button>
        {dispute.isError && (
          <span className="text-[12.5px] text-(--ssz-feedback-no-fg)">{t('sendFailed')}</span>
        )}
      </div>
    </div>
  );
}

/** Explicit branches rather than a template key: dynamic keys crash the type checker here. */
function aspectLabel(t: T, aspect: string): string {
  if (!(KNOWN_ASPECTS as readonly string[]).includes(aspect)) return aspect;
  switch (aspect) {
    case 'grammar':
      return t('aspect.grammar');
    case 'order':
      return t('aspect.order');
    case 'lexis':
      return t('aspect.lexis');
    case 'meaning':
      return t('aspect.meaning');
    case 'alternative':
      return t('aspect.alternative');
    case 'task':
      return t('aspect.task');
    case 'structure':
      return t('aspect.structure');
    case 'content':
      return t('aspect.content');
    default:
      return t('aspect.register');
  }
}

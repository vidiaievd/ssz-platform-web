'use client';

import type { RefObject } from 'react';
import { useTranslations } from 'next-intl';
import { ArrowRight, Check, Send, Undo2 } from 'lucide-react';

import { Button } from '@/components/ui/button';

import type { ReviewVerdict } from '../../api/use-decision';

import { CommentBox } from './comment-box';

/** What the engine accepts on the work as a whole (`review-attempt.dto.ts`). */
const COMMENT_MAX = 4000;

/**
 * The shortcuts, stated where they are used rather than in a help screen nobody opens.
 *
 * Permanently visible on purpose: a teacher who has just learned that `1` passes will use
 * it forty times today, and the line costs one row of small text. When there is no verdict
 * left to give only the movement keys are named — offering `1` on a submission a colleague
 * has already answered would be advertising a key that does nothing.
 */
function KeyHints({ readOnly }: { readOnly: boolean }) {
  const t = useTranslations('Review.decision.keys');

  const hints = readOnly
    ? ([['J', t('next')]] as const)
    : ([
        ['1', t('approve')],
        ['2', t('withComment')],
        ['3', t('return')],
        ['J', t('next')],
      ] as const);

  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px] text-muted-foreground">
      {hints.map(([key, label]) => (
        <span key={key} className="flex items-center gap-1">
          <kbd className="rounded-[5px] border-[1.5px] border-border bg-(--ssz-bg-subtle) px-[5px] py-px font-mono text-[10.5px] font-bold text-foreground">
            {key}
          </kbd>
          {label}
        </span>
      ))}
    </p>
  );
}

export interface DecisionPanelProps {
  comment: string;
  onCommentChange: (value: string) => void;
  /** Whether anything has been written against a single sentence (criterion 14). */
  hasSentenceComments: boolean;
  onDecide: (verdict: ReviewVerdict) => void;
  pending: boolean;
  /** A refusal about what is written, shown beside the field (criterion 18). */
  error: string | null;
  /**
   * The verdict that has settled this submission — this reviewer's, or the colleague's
   * who got here first. Either way there is nothing left to decide.
   */
  settled: 'approved' | 'returned' | null;
  /** Whether the reviewer may decide at all: an expired stand-in may only read. */
  canDecide: boolean;
  onNext: () => void;
  /** True while there is somewhere to go — false empties the "next" action. */
  hasNext: boolean;
  inputRef?: RefObject<HTMLTextAreaElement | null>;
}

/**
 * The bottom of the review screen: what the teacher writes, and the three things they
 * can do with it.
 *
 * Three buttons and no fourth field. There is nowhere to type a mark, on this screen or
 * any other (criterion 19) — the server derives it from what was approved, so two
 * teachers making the same decisions cannot hand the same learner two different marks,
 * and the footnote says so rather than leaving the absence to be discovered.
 *
 * What each button needs is what it means. An approval "with a comment" needs a comment
 * to be one, and a return needs one because the work goes back to the learner with it
 * attached and "do it again" on its own is not teaching. Both are disabled rather than
 * refused after the fact — the refusal exists too (a colleague may have emptied the
 * field in another tab), but a button that explains itself by failing is a worse button.
 *
 * Once something has been decided the panel stops being a form. The comment stays on
 * screen, readable and copyable, and the only action left is the next submission
 * (criterion 24): a teacher whose colleague answered first has lost the verdict, not
 * their two paragraphs.
 */
export function DecisionPanel({
  comment,
  onCommentChange,
  hasSentenceComments,
  onDecide,
  pending,
  error,
  settled,
  canDecide,
  onNext,
  hasNext,
  inputRef,
}: DecisionPanelProps) {
  const t = useTranslations('Review.decision');

  const written = comment.trim() !== '';
  const readOnly = settled !== null || !canDecide;

  return (
    <footer className="flex flex-col gap-3 border-t border-border bg-(--ssz-bg-surface) px-5 pb-4 pt-3.5">
      {settled === null ? null : (
        <p
          aria-live="polite"
          className="flex items-center gap-2 text-[13.5px] font-semibold"
          style={{
            color: settled === 'returned' ? 'oklch(0.50 0.10 82)' : 'oklch(0.48 0.12 145)',
          }}
        >
          <span aria-hidden className="flex">
            {settled === 'returned' ? (
              <Undo2 className="h-[18px] w-[18px]" />
            ) : (
              <Check className="h-[18px] w-[18px]" />
            )}
          </span>
          {t(settled === 'returned' ? 'sent.returned' : 'sent.approved')}
        </p>
      )}

      {/* Kept mounted when read-only rather than swapped for a paragraph: the draft is
          the thing a teacher reaches for after a conflict, and a textarea is where
          selecting and copying it already works. */}
      <CommentBox
        label={t('commentLabel')}
        placeholder={readOnly ? undefined : t('commentPlaceholder')}
        value={comment}
        onChange={onCommentChange}
        inputRef={inputRef}
        maxLength={COMMENT_MAX}
        error={error}
        readOnly={readOnly}
      />

      <div className="flex flex-wrap items-center gap-2">
        {readOnly ? (
          hasNext ? (
            <Button type="button" onClick={onNext}>
              <ArrowRight aria-hidden className="mr-1.5 h-4 w-4" />
              {t('next')}
            </Button>
          ) : null
        ) : (
          <>
            <Button
              type="button"
              loading={pending}
              aria-busy={pending}
              onClick={() => onDecide('approved')}
            >
              <Check aria-hidden className="mr-1.5 h-4 w-4" />
              {t('approve')}
            </Button>
            <Button
              type="button"
              variant="secondary"
              loading={pending}
              aria-busy={pending}
              disabled={!written && !hasSentenceComments}
              onClick={() => onDecide('approved_comment')}
            >
              <Send aria-hidden className="mr-1.5 h-4 w-4" />
              {t('approveWithComment')}
            </Button>
            <Button
              type="button"
              variant="ghost"
              loading={pending}
              aria-busy={pending}
              disabled={!written}
              onClick={() => onDecide('returned')}
            >
              <Undo2 aria-hidden className="mr-1.5 h-4 w-4" />
              {t('return')}
            </Button>
          </>
        )}
        <span className="flex-1" />
        <KeyHints readOnly={readOnly} />
      </div>

      <p className="text-[11.5px] leading-relaxed text-muted-foreground">
        {t('scoreIsServerSide')}
      </p>
    </footer>
  );
}

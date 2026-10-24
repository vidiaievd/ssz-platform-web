'use client';

import { useState } from 'react';
import { Check, PencilLine, Sparkles, Undo2, X } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';

import type { AiRemarkOutcome } from '../../stores/review-drafts';
import type { ReviewAiDraft, ReviewAiRemark } from '../../types';
import { CommentBox } from './comment-box';

const READING = 'var(--ssz-font-reading)';

/** The aspects the messages name; anything newer reads under its own code. */
const KNOWN_ASPECTS = [
  'grammar',
  'order',
  'lexis',
  'register',
  'alternative',
  'task',
  'structure',
  'content',
] as const;

/** As long as the overall comment may run, so a reworded remark is never cut by its own form. */
const ESSAY_REMARK_MAX = 4000;

/** Where the whole draft's outcome is kept, beside the per-remark ones. */
export const AI_DRAFT_KEY = 'draft';
/** Where the outcome of the draft's overall note is kept. */
export const AI_SUMMARY_KEY = 'summary';

/** One remark of the draft, with where its outcome is kept and what that outcome is. */
export interface AiRemarkEntry {
  key: string;
  remark: ReviewAiRemark;
  outcome: AiRemarkOutcome | undefined;
}

/**
 * Everything the card needs to draw a model's draft and record what the reviewer does
 * with it. Null on the card is the card as it was before plan 79: no key, no draft, or a
 * verdict already given.
 */
export interface AiDraftBinding {
  draft: ReviewAiDraft;
  outcomes: Record<string, AiRemarkOutcome>;
  setOutcome: (key: string, outcome: AiRemarkOutcome | undefined) => void;
  /**
   * Adds a paragraph to the comment on the whole work: the draft's overall note, or a
   * remark on an essay, which has no sentences to comment on one by one.
   */
  addToComment: (text: string) => void;
}

/** The remarks about one sentence, unless the reviewer has dropped the whole draft. */
export function remarksFor(binding: AiDraftBinding | null, itemId: string): AiRemarkEntry[] {
  if (binding === null || binding.outcomes[AI_DRAFT_KEY] === 'discarded') return [];
  return binding.draft.items.flatMap((remark, index) =>
    remark.itemId === itemId
      ? [{ key: String(index), remark, outcome: binding.outcomes[String(index)] }]
      : [],
  );
}

/** Every remark of the draft — an essay's, which all belong to its one text. */
export function allRemarks(binding: AiDraftBinding | null): AiRemarkEntry[] {
  if (binding === null || binding.outcomes[AI_DRAFT_KEY] === 'discarded') return [];
  return binding.draft.items.map((remark, index) => ({
    key: String(index),
    remark,
    outcome: binding.outcomes[String(index)],
  }));
}

/**
 * A remark as it goes into a comment to the learner.
 *
 * The fragment is quoted so the learner can find it, and the suggestion follows it, so what
 * they read is "this, as that, because". Nothing marks it as the model's: once a teacher
 * has taken it, it is the teacher's comment. A remark about a text as a whole quotes
 * nothing, and is its comment alone.
 */
export function remarkText(remark: ReviewAiRemark): string {
  if (remark.fragment === null) return remark.comment;
  const where =
    remark.suggestion === null || remark.suggestion.trim() === ''
      ? `«${remark.fragment}»`
      : `«${remark.fragment}» → «${remark.suggestion}»`;
  return `${where} — ${remark.comment}`;
}

/** A comment with one more paragraph on the end. */
export function appendParagraph(existing: string | undefined, text: string): string {
  const head = (existing ?? '').trim();
  return head === '' ? text : `${head}\n${text}`;
}

/**
 * The draft as a whole, above the sentences: what it is, how much it found, its overall note,
 * and the way to put all of it aside.
 *
 * Labelled as the model's in words, not only by colour: a teacher must never mistake a
 * remark nobody has checked for one a colleague wrote.
 */
export function AiDraftBanner({ binding }: { binding: AiDraftBinding }) {
  const t = useTranslations('Review.submission.ai');
  const { draft, outcomes, setOutcome, addToComment } = binding;

  if (outcomes[AI_DRAFT_KEY] === 'discarded') {
    return (
      <div className="flex items-center gap-2 rounded-[11px] border border-dashed border-border px-3 py-2 text-[12.5px] text-muted-foreground">
        <Sparkles aria-hidden className="h-3.5 w-3.5 shrink-0" />
        <span className="flex-1">{t('draftDiscarded')}</span>
        <Button
          type="button"
          variant="link"
          size="sm"
          onClick={() => setOutcome(AI_DRAFT_KEY, undefined)}
        >
          {t('restore')}
        </Button>
      </div>
    );
  }

  const summary = draft.summary?.trim() ?? '';
  const summaryOutcome = outcomes[AI_SUMMARY_KEY];

  return (
    <section
      aria-label={t('title')}
      className="flex flex-col gap-2 rounded-[11px] border-[1.5px] border-dashed border-border bg-(--ssz-bg-subtle) px-3 py-2.5"
    >
      <div className="flex flex-wrap items-center gap-2">
        <Sparkles aria-hidden className="h-4 w-4 shrink-0 text-(--ssz-text-accent)" />
        <span className="text-[13px] font-semibold">{t('title')}</span>
        <span className="text-[12px] text-muted-foreground">
          {/* No model name: the engine holds the registry's id, which means nothing to a
              teacher — and which model wrote it is not what they are deciding on. */}
          {draft.items.length === 0 ? t('none') : t('count', { count: draft.items.length })}
        </span>
        <span className="flex-1" />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setOutcome(AI_DRAFT_KEY, 'discarded')}
        >
          {t('discardDraft')}
        </Button>
      </div>

      <p className="text-[12px] text-muted-foreground">{t('hint')}</p>

      {summary === '' ? null : (
        <div className="flex flex-wrap items-start gap-2">
          <p
            className="min-w-0 flex-1 text-[13.5px] leading-relaxed"
            style={{ fontFamily: READING }}
          >
            {summary}
          </p>
          {summaryOutcome === 'accepted' ? (
            <span className="flex items-center gap-1 text-[12px] text-success-700">
              <Check aria-hidden className="h-3.5 w-3.5" />
              {t('summaryTaken')}
            </span>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                addToComment(summary);
                setOutcome(AI_SUMMARY_KEY, 'accepted');
              }}
            >
              {t('takeSummary')}
            </Button>
          )}
        </div>
      )}
    </section>
  );
}

/**
 * One remark, under the sentence it is about.
 *
 * Three ways out and each is recorded: taken as written, taken and reworded, dropped. A
 * remark that has been dealt with shrinks to a line saying how, so the sentence reads as
 * work done rather than as a list of suggestions still waiting.
 */
export function AiRemarkCard({
  entry,
  scope = 'text',
  onAccept,
  onEdit,
  onDiscard,
  onRestore,
}: {
  entry: AiRemarkEntry;
  /** What a remark without a quotation is about: an essay's text, or one answer of a set. */
  scope?: 'text' | 'answer';
  onAccept: () => void;
  onEdit: () => void;
  onDiscard: () => void;
  /** Takes a drop back. Taking back a remark already in the comment is the comment's job. */
  onRestore: () => void;
}) {
  const t = useTranslations('Review.submission.ai');
  const { remark, outcome } = entry;

  if (outcome !== undefined) {
    return (
      <p className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
        <Sparkles aria-hidden className="h-3.5 w-3.5 shrink-0" />
        {remark.fragment === null ? (
          <span className="min-w-0 truncate">{aspectLabel(t, remark.aspect)}</span>
        ) : (
          <span className="min-w-0 truncate" style={{ fontFamily: READING }}>
            «{remark.fragment}»
          </span>
        )}
        <span aria-hidden>·</span>
        <span className="shrink-0">
          {outcome === 'accepted'
            ? t('accepted')
            : outcome === 'edited'
              ? t('edited')
              : t('remarkDiscarded')}
        </span>
        {outcome === 'discarded' ? (
          <button
            type="button"
            onClick={onRestore}
            className="flex shrink-0 items-center gap-1 font-semibold text-(--ssz-text-accent) hover:underline"
          >
            <Undo2 aria-hidden className="h-3 w-3" />
            {t('restore')}
          </button>
        ) : null}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-1.5 rounded-[9px] border-[1.5px] border-dashed border-border px-3 py-2">
      <p className="flex flex-wrap items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
        <Sparkles aria-hidden className="h-3.5 w-3.5 shrink-0 text-(--ssz-text-accent)" />
        <span>{t('label')}</span>
        <span aria-hidden>·</span>
        <span>{aspectLabel(t, remark.aspect)}</span>
        {remark.fragment === null ? (
          <>
            <span aria-hidden>·</span>
            <span>{scope === 'answer' ? t('wholeAnswer') : t('wholeText')}</span>
          </>
        ) : null}
      </p>
      {remark.fragment === null ? null : (
        <p className="text-[13.5px] leading-relaxed" style={{ fontFamily: READING }}>
          <span className="rounded bg-warning-100 px-1 dark:bg-warning-500/20">
            {remark.fragment}
          </span>
          {remark.suggestion === null || remark.suggestion.trim() === '' ? null : (
            <>
              {' → '}
              <span className="font-semibold">{remark.suggestion}</span>
            </>
          )}
        </p>
      )}
      <p className="text-[13px] leading-relaxed text-(--ssz-text-secondary)">{remark.comment}</p>
      <div className="flex flex-wrap gap-1.5">
        <Button type="button" variant="ghost" size="sm" onClick={onAccept}>
          <Check aria-hidden className="h-3.5 w-3.5" />
          {t('accept')}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onEdit}>
          <PencilLine aria-hidden className="h-3.5 w-3.5" />
          {t('edit')}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onDiscard}>
          <X aria-hidden className="h-3.5 w-3.5" />
          {t('discard')}
        </Button>
      </div>
    </div>
  );
}

/**
 * An essay's remarks, under the text (plan 79, 1.7b).
 *
 * An essay is marked as a whole and has no sentence to hang a comment on, so what the
 * teacher takes goes into the comment on the whole work. Rewording happens in a form of its
 * own, opened with the remark alone: the overall comment may already hold the teacher's
 * words, and they are not the remark's to edit. Saved, the reworded text is added and the
 * remark counts as edited; cancelled, it waits as if the button had never been pressed.
 */
export function EssayAiRemarks({ binding }: { binding: AiDraftBinding }) {
  const t = useTranslations('Review.submission.ai');
  const [rewording, setRewording] = useState<{ key: string; text: string } | null>(null);
  const entries = allRemarks(binding);
  if (entries.length === 0) return null;

  return (
    <div className="flex flex-col gap-1.5">
      {entries.map((entry) =>
        rewording?.key === entry.key ? (
          <CommentBox
            key={entry.key}
            label={t('editLabel')}
            value={rewording.text}
            rows={3}
            maxLength={ESSAY_REMARK_MAX}
            onChange={(text) => setRewording({ key: entry.key, text })}
            onCancel={() => setRewording(null)}
            onSave={() => {
              const text = rewording.text.trim();
              if (text !== '') {
                binding.addToComment(text);
                binding.setOutcome(entry.key, 'edited');
              }
              setRewording(null);
            }}
          />
        ) : (
          <AiRemarkCard
            key={entry.key}
            entry={entry}
            onAccept={() => {
              binding.addToComment(remarkText(entry.remark));
              binding.setOutcome(entry.key, 'accepted');
            }}
            onEdit={() => setRewording({ key: entry.key, text: remarkText(entry.remark) })}
            onDiscard={() => binding.setOutcome(entry.key, 'discarded')}
            onRestore={() => binding.setOutcome(entry.key, undefined)}
          />
        ),
      )}
    </div>
  );
}

/** Explicit branches rather than a template key: dynamic keys crash the type checker here. */
function aspectLabel(
  t: ReturnType<typeof useTranslations<'Review.submission.ai'>>,
  aspect: string,
): string {
  if (!(KNOWN_ASPECTS as readonly string[]).includes(aspect)) return aspect;
  switch (aspect) {
    case 'grammar':
      return t('aspect.grammar');
    case 'order':
      return t('aspect.order');
    case 'lexis':
      return t('aspect.lexis');
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

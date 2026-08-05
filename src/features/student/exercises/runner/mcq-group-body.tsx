'use client';

import { CheckCircle, XCircle } from 'lucide-react';
import { useEffect } from 'react';
import { useTranslations } from 'next-intl';

import { Instr } from './instr';
import { modeAccentSoft, type RunnerMode, type RunnerPhase } from './types';

export interface McqGroupOption {
  id: string;
  text: string;
}

export interface McqGroupQuestion {
  id: string;
  question: string;
  /** Falls back to the group's shared options when absent. */
  options?: McqGroupOption[];
}

export interface McqGroupContent {
  items: McqGroupQuestion[];
  /**
   * Options every question shares — the Riktig / Galt pair of a true-false
   * table. Questions carrying their own options ignore it.
   */
  options?: McqGroupOption[];
  instruction?: string;
  context?: string;
}

export interface McqGroupExpectedItem {
  id: string;
  correct_option_ids: string[];
  /** Why this question's answer is what it is; held back until revealed. */
  explanation?: string;
}

export interface McqGroupExpectedAnswers {
  items: McqGroupExpectedItem[];
  explanation?: string;
}

/** question id → picked option id (missing key = unanswered). */
export type McqGroupValue = Record<string, string>;

export interface McqGroupItemResult {
  correct: boolean;
  /** The key's option id, shown once the answers are unlocked. */
  expected: string;
  explanation?: string;
}

/** question id → outcome; only present in the feedback phase. */
export type McqGroupResults = Record<string, McqGroupItemResult>;

export interface McqGroupBodyProps {
  content: McqGroupContent;
  value: McqGroupValue;
  onValueChange: (value: McqGroupValue) => void;
  onAnswerChange: (canSubmit: boolean) => void;
  phase: RunnerPhase;
  /** null in graded mode — the body never reveals correctness there. */
  ok: boolean | null;
  mode: RunnerMode;
  accent: string;
  results?: McqGroupResults;
  /** Once set, a missed question shows the key and the author's note. */
  revealed?: boolean;
}

const OK_BG = 'var(--ssz-feedback-ok-bg)';
const OK_LINE = 'var(--ssz-feedback-ok-line)';
const OK_FG = 'var(--ssz-feedback-ok-fg)';
const NO_BG = 'var(--ssz-feedback-no-bg)';
const NO_LINE = 'var(--ssz-feedback-no-line)';
const NO_FG = 'var(--ssz-feedback-no-fg)';

/** The options a question offers: its own if it has any, else the group's. */
export function optionsOf(content: McqGroupContent, item: McqGroupQuestion): McqGroupOption[] {
  return item.options && item.options.length > 0 ? item.options : (content.options ?? []);
}

/**
 * The learner's picks with every missed question cleared, ready for a second
 * attempt: re-answering the ones already right teaches nothing, and leaving a
 * wrong pick in place invites tapping the other option at random.
 */
export function keepCorrectPicks(value: McqGroupValue, results: McqGroupResults): McqGroupValue {
  const kept: McqGroupValue = {};
  for (const [itemId, optionId] of Object.entries(value)) {
    if (results[itemId]?.correct) kept[itemId] = optionId;
  }
  return kept;
}

/**
 * True when every question draws on the same shared options, which is what a
 * printed true/false table looks like: statements down the left, one column per
 * answer. Questions with options of their own get the roomier stacked layout.
 */
function isTable(content: McqGroupContent): boolean {
  return (
    (content.options?.length ?? 0) > 0 &&
    content.items.every((item) => (item.options?.length ?? 0) === 0)
  );
}

/**
 * A block of multiple-choice questions answered together and checked once:
 * Riktig/Galt over a text, or a set of word meanings. Each question is its own
 * radio group — exactly one answer, which is what checkboxes would fail to
 * guarantee — and the check button belongs to the block, not the question.
 */
export function McqGroupBody({
  content,
  value,
  onValueChange,
  onAnswerChange,
  phase,
  ok,
  mode,
  accent,
  results,
  revealed = false,
}: McqGroupBodyProps) {
  const t = useTranslations('ExerciseRunner');
  const isAnswering = phase === 'answering';
  const reveal = phase === 'feedback';
  const accentSoft = modeAccentSoft(mode);
  const table = isTable(content);

  const answered = content.items.filter((item) => value[item.id] !== undefined).length;
  const allAnswered = content.items.length > 0 && answered === content.items.length;

  useEffect(() => {
    onAnswerChange(allAnswered);
  }, [allAnswered, onAnswerChange]);

  function pick(itemId: string, optionId: string) {
    if (!isAnswering) return;
    onValueChange({ ...value, [itemId]: optionId });
  }

  /** Colours one option button of one question. */
  function optionStyle(itemId: string, optionId: string) {
    const picked = value[itemId] === optionId;
    const result = results?.[itemId];
    const isKey = reveal && ok !== null && result?.expected === optionId;

    if (reveal) {
      // The key is only coloured in once the learner has asked to see it —
      // otherwise the first check would hand over every answer.
      if (isKey && (revealed || result?.correct)) {
        return { bg: OK_BG, border: OK_LINE, color: OK_FG };
      }
      if (picked && result?.correct === false) {
        return { bg: NO_BG, border: NO_LINE, color: NO_FG };
      }
      if (picked) return { bg: accentSoft, border: accent, color: 'var(--ssz-text-primary)' };
      return {
        bg: 'var(--ssz-bg-surface)',
        border: 'var(--ssz-border-default)',
        color: 'var(--ssz-text-muted)',
      };
    }

    if (picked) return { bg: accentSoft, border: accent, color: 'var(--ssz-text-primary)' };
    return {
      bg: 'var(--ssz-bg-surface)',
      border: 'var(--ssz-border-default)',
      color: 'var(--ssz-text-primary)',
    };
  }

  /* Plain render helpers, not nested components: a component defined during
     render is a new type every pass, so React would remount the buttons and
     drop the focus the learner is navigating with. */
  function renderOption(item: McqGroupQuestion, option: McqGroupOption, compact: boolean) {
    const picked = value[item.id] === option.id;
    const result = results?.[item.id];
    const s = optionStyle(item.id, option.id);
    const showOk =
      reveal && ok !== null && result?.expected === option.id && (revealed || result.correct);
    const showNo = reveal && picked && result?.correct === false;

    return (
      <button
        key={option.id}
        type="button"
        role="radio"
        aria-checked={picked}
        disabled={!isAnswering}
        onClick={() => pick(item.id, option.id)}
        className="flex items-center gap-2 rounded-xl text-[15px] font-medium transition-colors focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-(--ssz-border-focus)"
        style={{
          padding: compact ? '8px 14px' : '12px 16px',
          border: `2px solid ${s.border}`,
          background: s.bg,
          color: s.color,
          cursor: isAnswering ? 'pointer' : 'default',
          textAlign: 'left',
          ...(compact ? {} : { width: '100%' }),
        }}
      >
        <span className="flex-1">{option.text}</span>
        {showOk && (
          <CheckCircle size={17} style={{ color: OK_LINE, flexShrink: 0 }} aria-hidden="true" />
        )}
        {showNo && (
          <XCircle size={17} style={{ color: NO_LINE, flexShrink: 0 }} aria-hidden="true" />
        )}
      </button>
    );
  }

  /** The author's note for a missed question, once the answers are unlocked. */
  function renderNote(itemId: string) {
    const result = results?.[itemId];
    if (!reveal || !revealed || !result || result.correct || !result.explanation) return null;
    return (
      <p className="mt-1.5 w-full text-[13.5px]" style={{ color: 'var(--ssz-text-secondary)' }}>
        {result.explanation}
      </p>
    );
  }

  return (
    <div>
      {content.instruction && <Instr>{content.instruction}</Instr>}
      {content.context && (
        <p className="mb-4 text-[14px]" style={{ color: 'var(--ssz-text-secondary)' }}>
          {content.context}
        </p>
      )}

      <ol className="flex flex-col gap-3">
        {content.items.map((item, i) => {
          const options = optionsOf(content, item);
          const result = results?.[item.id];
          const rowTone =
            reveal && ok !== null && result
              ? result.correct
                ? OK_LINE
                : NO_LINE
              : 'var(--ssz-border-default)';

          return (
            <li
              key={item.id}
              className={
                table
                  ? 'flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-xl border px-4 py-3'
                  : 'rounded-xl border px-4 py-3.5'
              }
              style={{ borderColor: rowTone }}
            >
              <div
                className={table ? 'flex min-w-[min(100%,16rem)] flex-1 gap-2.5' : 'flex gap-2.5'}
              >
                <span className="pt-0.5 text-[13px] font-semibold text-(--ssz-text-muted)">
                  {i + 1}.
                </span>
                <p
                  className="text-[15.5px] leading-relaxed"
                  style={{
                    fontFamily: 'var(--ssz-font-reading)',
                    color: 'var(--ssz-text-primary)',
                  }}
                >
                  {item.question}
                </p>
              </div>

              <div
                role="radiogroup"
                aria-label={t('mcqGroup.questionOptions', { n: i + 1 })}
                className={table ? 'flex gap-2' : 'mt-3 flex flex-col gap-2'}
              >
                {options.map((option) => renderOption(item, option, table))}
              </div>

              {renderNote(item.id)}
            </li>
          );
        })}
      </ol>

      {!reveal && (
        <p className="mt-4 text-[12.5px] text-(--ssz-text-muted)">
          {t('mcqGroup.answeredCount', { done: answered, total: content.items.length })}
        </p>
      )}
    </div>
  );
}

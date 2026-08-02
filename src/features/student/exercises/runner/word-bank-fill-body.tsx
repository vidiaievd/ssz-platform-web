'use client';

import { useEffect, useMemo } from 'react';
import { useTranslations } from 'next-intl';

import { Instr } from './instr';
import { RationaleMatrix, type Rationale } from './rationale-matrix';
import { modeAccentSoft, type RunnerMode, type RunnerPhase } from './types';

export interface WordBankSentence {
  id: string;
  /** Blanks marked `___N___`, numbered within this sentence. */
  textWithBlanks: string;
}

export interface WordBankFillContent {
  /** Shared choices offered for every blank of every sentence. */
  wordBank: string[];
  items: WordBankSentence[];
  instruction?: string;
  /**
   * Set for drills where one bank word is the answer to several blanks — a
   * grammar exercise on `at` / `om` reuses both many times over. It turns off
   * the spent-word dimming, which would otherwise mislabel the right answer
   * as already used.
   */
  reusableWords?: boolean;
}

export interface WordBankFillExpectedBlank {
  blank_id: number;
  accepted_answers: string[];
  /** Optional per-blank teaching aid, shown only when this blank was missed. */
  rationale?: Rationale;
}

export interface WordBankFillExpectedItem {
  id: string;
  blanks: WordBankFillExpectedBlank[];
}

export interface WordBankFillExpectedAnswers {
  items: WordBankFillExpectedItem[];
  explanation?: string;
}

/** itemId → blankId → chosen bank word (missing key = still blank). */
export type WordBankFillValue = Record<string, Record<number, string>>;

export interface WordBankBlankResult {
  correct: boolean;
  /** First accepted answer, shown when the learner was wrong. */
  expected: string;
  /** Carried over from the expected answers so feedback can explain the miss. */
  rationale?: Rationale;
}

/** itemId → blankId → outcome; only present in the feedback phase. */
export type WordBankFillResults = Record<string, Record<number, WordBankBlankResult>>;

export interface WordBankFillBodyProps {
  content: WordBankFillContent;
  value: WordBankFillValue;
  onValueChange: (value: WordBankFillValue) => void;
  onAnswerChange: (canSubmit: boolean) => void;
  phase: RunnerPhase;
  /** null in graded mode — the body never reveals correctness there. */
  ok: boolean | null;
  mode: RunnerMode;
  accent: string;
  results?: WordBankFillResults;
}

const OK_LINE = 'var(--ssz-feedback-ok-line)';
const OK_FG = 'var(--ssz-feedback-ok-fg)';
const NO_LINE = 'var(--ssz-feedback-no-line)';
const NO_FG = 'var(--ssz-feedback-no-fg)';
const READING = 'var(--ssz-font-reading)';

type Segment = { kind: 'text'; text: string } | { kind: 'blank'; blankId: number };

/** Splits "I try not to ___1___ when I meet …" into text and blank segments. */
export function parseSentence(text: string): Segment[] {
  const segments: Segment[] = [];
  const re = /___(\d+)___/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) segments.push({ kind: 'text', text: text.slice(last, m.index) });
    segments.push({ kind: 'blank', blankId: Number(m[1]) });
    last = m.index + m[0].length;
  }
  if (last < text.length) segments.push({ kind: 'text', text: text.slice(last) });
  return segments;
}

/** The blank ids of one sentence, in reading order. */
function blankIdsOf(item: WordBankSentence): number[] {
  return parseSentence(item.textWithBlanks)
    .filter((s): s is { kind: 'blank'; blankId: number } => s.kind === 'blank')
    .map((s) => s.blankId);
}

/** Every blank of the exercise, in reading order. */
function allBlanks(items: WordBankSentence[]): Array<{ itemId: string; blankId: number }> {
  return items.flatMap((item) =>
    blankIdsOf(item).map((blankId) => ({ itemId: item.id, blankId })),
  );
}

interface MissedBlank {
  itemId: string;
  blankId: number;
  /** 1-based position of the sentence, for the matrix label. */
  itemNumber: number;
  /** True when the sentence has more than one blank, so the label must say which. */
  numbered: boolean;
  chosen: string;
  rationale: Rationale;
}

/**
 * The blanks worth explaining after a check: missed ones that carry an authored
 * rationale. Correct blanks are skipped on purpose — a ten-sentence drill would
 * otherwise answer with ten tables, and the learner needs the traps they fell
 * into, not the ones they avoided.
 */
export function missedBlanksWithRationale(
  items: WordBankSentence[],
  value: WordBankFillValue,
  results: WordBankFillResults,
): MissedBlank[] {
  return items.flatMap((item, i) => {
    const ids = blankIdsOf(item);
    return ids.flatMap((blankId) => {
      const result = results[item.id]?.[blankId];
      if (!result || result.correct || !result.rationale) return [];
      return [
        {
          itemId: item.id,
          blankId,
          itemNumber: i + 1,
          numbered: ids.length > 1,
          chosen: value[item.id]?.[blankId] ?? '',
          rationale: result.rationale,
        },
      ];
    });
  });
}

export function WordBankFillBody({
  content,
  value,
  onValueChange,
  onAnswerChange,
  phase,
  ok,
  mode,
  accent,
  results,
}: WordBankFillBodyProps) {
  const t = useTranslations('ExerciseRunner');
  const reveal = phase === 'feedback';
  const blanks = useMemo(() => allBlanks(content.items), [content.items]);

  /* A bank word is "spent" once it is used — the textbook default is one word
     per blank. It stays selectable so a learner can move it, just dimmed.
     Drills that reuse the same word across blanks opt out entirely. */
  const used = content.reusableWords
    ? new Set<string>()
    : new Set(Object.values(value).flatMap((byBlank) => Object.values(byBlank).filter(Boolean)));

  const filled = blanks.filter(({ itemId, blankId }) => (value[itemId]?.[blankId] ?? '') !== '');
  const allFilled = blanks.length > 0 && filled.length === blanks.length;

  useEffect(() => {
    onAnswerChange(allFilled);
  }, [allFilled, onAnswerChange]);

  function setBlank(itemId: string, blankId: number, word: string) {
    onValueChange({ ...value, [itemId]: { ...(value[itemId] ?? {}), [blankId]: word } });
  }

  function blankTone(itemId: string, blankId: number) {
    if (!reveal || ok === null) return { line: accent, fg: 'var(--ssz-text-primary)' };
    const result = results?.[itemId]?.[blankId];
    return result?.correct ? { line: OK_LINE, fg: OK_FG } : { line: NO_LINE, fg: NO_FG };
  }

  return (
    <div>
      {content.instruction && <Instr>{content.instruction}</Instr>}

      <div
        className="mb-6 flex flex-wrap gap-2 rounded-xl border border-(--ssz-border-default) px-4 py-3.5"
        aria-label={t('wordBank.bankLabel')}
      >
        {content.wordBank.map((word) => (
          <span
            key={word}
            className="rounded-lg px-2.5 py-1 text-[14px] transition-opacity"
            style={{
              fontFamily: READING,
              background: 'var(--ssz-bg-muted)',
              color: 'var(--ssz-text-secondary)',
              opacity: used.has(word) ? 0.4 : 1,
            }}
          >
            {word}
          </span>
        ))}
      </div>

      <ol className="flex flex-col gap-3.5">
        {content.items.map((item, i) => (
          <li key={item.id} className="flex gap-2.5">
            <span className="pt-1.5 text-[13px] font-semibold text-(--ssz-text-muted)">{i + 1}.</span>
            <p
              className="flex flex-wrap items-center gap-x-1 gap-y-1.5 text-[15.5px] leading-relaxed"
              style={{ fontFamily: READING, color: 'var(--ssz-text-primary)' }}
            >
              {parseSentence(item.textWithBlanks).map((seg, idx) => {
                if (seg.kind === 'text') return <span key={idx}>{seg.text}</span>;

                const chosen = value[item.id]?.[seg.blankId] ?? '';
                const tone = blankTone(item.id, seg.blankId);
                const result = reveal && ok !== null ? results?.[item.id]?.[seg.blankId] : undefined;

                if (reveal) {
                  return (
                    <span key={idx} className="inline-flex items-baseline gap-1.5">
                      <span
                        className="font-semibold"
                        style={{ color: tone.fg, borderBottom: `2px solid ${tone.line}` }}
                      >
                        {chosen || '—'}
                      </span>
                      {result && !result.correct && (
                        <span className="text-[13.5px] font-semibold" style={{ color: OK_FG }}>
                          {result.expected}
                        </span>
                      )}
                    </span>
                  );
                }

                return (
                  <select
                    key={idx}
                    value={chosen}
                    onChange={(e) => setBlank(item.id, seg.blankId, e.target.value)}
                    aria-label={t('wordBank.blankLabel', { n: i + 1 })}
                    className="rounded-lg border border-(--ssz-border-default) bg-surface px-2 py-1 text-[14px] text-(--ssz-text-primary) focus-visible:ring-2 focus-visible:ring-(--ssz-border-focus) focus-visible:outline-none"
                    style={{
                      borderColor: chosen ? accent : undefined,
                      background: chosen ? modeAccentSoft(mode) : undefined,
                    }}
                  >
                    <option value="">{t('wordBank.choosePlaceholder')}</option>
                    {content.wordBank.map((word) => (
                      <option key={word} value={word}>
                        {word}
                      </option>
                    ))}
                  </select>
                );
              })}
            </p>
          </li>
        ))}
      </ol>

      {/* One matrix per missed blank that has an authored rationale. */}
      {reveal &&
        ok !== null &&
        missedBlanksWithRationale(content.items, value, results ?? {}).map((miss) => (
          <RationaleMatrix
            key={`${miss.itemId}-${miss.blankId}`}
            rationale={miss.rationale}
            chosen={miss.chosen}
            label={
              miss.numbered
                ? t('wordBank.rationaleItemBlank', { n: miss.itemNumber, b: miss.blankId })
                : t('wordBank.rationaleItem', { n: miss.itemNumber })
            }
          />
        ))}

      {!reveal && (
        <p className="mt-4 text-[12.5px] text-(--ssz-text-muted)">
          {t('wordBank.filledCount', { done: filled.length, total: blanks.length })}
        </p>
      )}
    </div>
  );
}

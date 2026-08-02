'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';

import { AnswerNoteMarker, buildAnswerNote, type Rationale, type WordNotes } from './answer-note';
import { Instr } from './instr';
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
  /**
   * Notes about the bank words, shared by every blank. In an at / om drill the
   * reason a word does or doesn't fit is the same in all ten sentences, so it
   * is authored once here rather than repeated per blank.
   */
  wordNotes?: WordNotes;
  /**
   * How a blank is answered. `chips` (default) is the textbook layout: one
   * shared bank above the sentences, words tapped into the armed blank.
   * `select` puts the whole bank in a dropdown inside each blank — better for
   * short vocabulary drills, where hunting for the armed blank is busywork.
   */
  inputMode?: 'chips' | 'select';
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
  /** Once set, a missed blank's note may name the answer and quote the rule. */
  revealed?: boolean;
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

/**
 * The learner's answers with every missed blank emptied, ready for a second
 * attempt: re-entering the blanks they already got right teaches nothing and
 * risks spoiling them, so only the misses come back as gaps.
 */
export function keepCorrectBlanks(
  value: WordBankFillValue,
  results: WordBankFillResults,
): WordBankFillValue {
  const kept: WordBankFillValue = {};
  for (const [itemId, byBlank] of Object.entries(value)) {
    for (const [blankId, word] of Object.entries(byBlank)) {
      if (results[itemId]?.[Number(blankId)]?.correct) {
        kept[itemId] = { ...(kept[itemId] ?? {}), [Number(blankId)]: word };
      }
    }
  }
  return kept;
}

/** Stable identity of one blank across the sentence list and the bank. */
export const blankKey = (itemId: string, blankId: number): string => `${itemId}:${blankId}`;

const splitBlankKey = (key: string): [string, number] => {
  const at = key.lastIndexOf(':');
  return [key.slice(0, at), Number(key.slice(at + 1))];
};

/** Every blank of the exercise, in reading order. */
function allBlanks(items: WordBankSentence[]): Array<{ itemId: string; blankId: number }> {
  return items.flatMap((item) =>
    blankIdsOf(item).map((blankId) => ({ itemId: item.id, blankId })),
  );
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
  revealed = false,
}: WordBankFillBodyProps) {
  const t = useTranslations('ExerciseRunner');
  const reveal = phase === 'feedback';
  const isAnswering = phase === 'answering';
  const asSelect = content.inputMode === 'select';
  /* Which blank's note is open — at most one, so opening a new one closes it. */
  const [openNote, setOpenNote] = useState<string | null>(null);
  const blanks = useMemo(() => allBlanks(content.items), [content.items]);
  /* Which blank the next bank word lands in. Two-step by necessity: with many
     blanks sharing one bank, a word click has to know its target. */
  const [activeKey, setActiveKey] = useState<string | null>(null);

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

  const wordAt = (key: string): string => {
    const blank = blanks.find((b) => blankKey(b.itemId, b.blankId) === key);
    return blank ? value[blank.itemId]?.[blank.blankId] ?? '' : '';
  };

  /** The blank a word click should fill: the armed one, else the first empty. */
  const targetKey =
    activeKey ??
    (() => {
      const empty = blanks.find(({ itemId, blankId }) => (value[itemId]?.[blankId] ?? '') === '');
      return empty ? blankKey(empty.itemId, empty.blankId) : null;
    })();

  /** Keeps the flow going: after filling, arm the next blank still empty. */
  function nextEmptyAfter(key: string): string | null {
    const at = blanks.findIndex((b) => blankKey(b.itemId, b.blankId) === key);
    const ordered = [...blanks.slice(at + 1), ...blanks.slice(0, Math.max(at, 0))];
    const empty = ordered.find(({ itemId, blankId }) => (value[itemId]?.[blankId] ?? '') === '');
    return empty ? blankKey(empty.itemId, empty.blankId) : null;
  }

  function pickWord(word: string) {
    if (!isAnswering || targetKey === null) return;
    const [itemId, blankId] = splitBlankKey(targetKey);
    // Clicking the word already sitting in the armed blank takes it back out.
    if (wordAt(targetKey) === word) {
      setBlank(itemId, blankId, '');
      setActiveKey(targetKey);
      return;
    }
    setBlank(itemId, blankId, word);
    setActiveKey(nextEmptyAfter(targetKey));
  }

  function blankTone(itemId: string, blankId: number) {
    if (!reveal || ok === null) return { line: accent, fg: 'var(--ssz-text-primary)' };
    const result = results?.[itemId]?.[blankId];
    return result?.correct ? { line: OK_LINE, fg: OK_FG } : { line: NO_LINE, fg: NO_FG };
  }

  /* 1–9 select a bank word for the armed blank, matching FillBody's shortcuts.
     Dropdowns bring their own keyboard handling, so they get no shortcuts. */
  useEffect(() => {
    if (!isAnswering || asSelect) return;
    function onKeyDown(e: KeyboardEvent) {
      const tag = ((e.target as HTMLElement).tagName ?? '').toLowerCase();
      if (tag === 'input' || tag === 'textarea') return;
      const n = parseInt(e.key, 10);
      const word = n >= 1 && n <= 9 ? content.wordBank[n - 1] : undefined;
      if (word !== undefined) pickWord(word);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  return (
    <div>
      {content.instruction && <Instr>{content.instruction}</Instr>}

      {/* In select mode every dropdown carries the whole bank, so a strip of
          the same words above the sentences would only repeat itself. */}
      {!asSelect && (
        <div
          className="mb-6 flex flex-wrap gap-2 rounded-xl border border-(--ssz-border-default) px-4 py-3.5"
          role="group"
          aria-label={t('wordBank.bankLabel')}
        >
          {content.wordBank.map((word, i) => {
            const inTarget = targetKey !== null && wordAt(targetKey) === word;
            return (
              <button
                key={word}
                type="button"
                disabled={!isAnswering}
                onClick={() => pickWord(word)}
                aria-pressed={inTarget}
                className="rounded-lg px-2.5 py-1 text-[14px] transition-opacity focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-(--ssz-border-focus)"
                style={{
                  fontFamily: READING,
                  border: `1.5px solid ${inTarget ? accent : 'transparent'}`,
                  background: inTarget ? modeAccentSoft(mode) : 'var(--ssz-bg-muted)',
                  color: inTarget ? accent : 'var(--ssz-text-secondary)',
                  opacity: used.has(word) ? 0.4 : 1,
                  cursor: isAnswering ? 'pointer' : 'default',
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    fontSize: 10,
                    fontFamily: 'var(--ssz-font-ui)',
                    fontWeight: 700,
                    opacity: 0.5,
                    marginRight: 6,
                  }}
                >
                  {i + 1}
                </span>
                {word}
              </button>
            );
          })}
        </div>
      )}

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
                  /* Once the answer is unlocked it stands in the sentence, with
                     the learner's word struck out beside it for contrast. */
                  const showAnswer = revealed && result !== undefined && !result.correct;
                  const note = result
                    ? buildAnswerNote({
                        rationale: result.rationale,
                        wordNotes: content.wordNotes,
                        chosen,
                        correct: result.expected,
                        chosenCorrect: result.correct,
                        revealed,
                      })
                    : null;

                  /* The marker is a sibling of the blank, not a child: its
                     panel claims a full row of this wrapping flex line. */
                  return (
                    <Fragment key={idx}>
                      {showAnswer ? (
                        <span className="inline-flex items-baseline gap-1.5">
                          <span
                            className="font-semibold"
                            style={{ color: OK_FG, borderBottom: `2px solid ${OK_LINE}` }}
                          >
                            {result.expected}
                          </span>
                          {chosen !== '' && (
                            <span className="text-[13.5px]" style={{ color: NO_FG }}>
                              <span className="sr-only">{t('fill.yourAnswer')}: </span>
                              <s>{chosen}</s>
                            </span>
                          )}
                        </span>
                      ) : (
                        <span
                          className="font-semibold"
                          style={{ color: tone.fg, borderBottom: `2px solid ${tone.line}` }}
                        >
                          {chosen || '—'}
                        </span>
                      )}
                      {note && result && (
                        <AnswerNoteMarker
                          note={note}
                          correct={result.correct}
                          open={openNote === `${item.id}:${seg.blankId}`}
                          onToggle={() =>
                            setOpenNote((k) =>
                              k === `${item.id}:${seg.blankId}` ? null : `${item.id}:${seg.blankId}`,
                            )
                          }
                          label={t('wordBank.blankLabel', { n: i + 1 })}
                        />
                      )}
                    </Fragment>
                  );
                }

                const key = blankKey(item.id, seg.blankId);
                const armed = targetKey === key;

                if (asSelect) {
                  return (
                    <select
                      key={idx}
                      value={chosen}
                      onChange={(e) => setBlank(item.id, seg.blankId, e.target.value)}
                      aria-label={t('wordBank.blankLabel', { n: i + 1 })}
                      className="rounded-lg px-2 py-1 text-[14px] focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-(--ssz-border-focus)"
                      style={{
                        fontFamily: READING,
                        fontWeight: chosen ? 600 : 400,
                        color: chosen ? accent : 'var(--ssz-text-muted)',
                        background: 'var(--ssz-bg-muted)',
                        border: `1.5px solid ${chosen ? accent : 'var(--ssz-border-default)'}`,
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
                }

                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setActiveKey(key)}
                    aria-pressed={armed}
                    aria-label={t('wordBank.blankLabel', { n: i + 1 })}
                    className="rounded-lg px-2.5 py-1 text-[14px] transition-colors focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-(--ssz-border-focus)"
                    style={{
                      minWidth: 88,
                      fontFamily: READING,
                      fontWeight: chosen ? 600 : 400,
                      color: chosen ? accent : 'var(--ssz-text-muted)',
                      borderBottom: `2px solid ${armed || chosen ? accent : 'var(--ssz-border-default)'}`,
                      background: armed ? modeAccentSoft(mode) : 'transparent',
                      cursor: 'pointer',
                    }}
                  >
                    {chosen || t('wordBank.choosePlaceholder')}
                  </button>
                );
              })}
            </p>
          </li>
        ))}
      </ol>

      {!reveal && (
        <p className="mt-4 text-[12.5px] text-(--ssz-text-muted)">
          {asSelect
            ? t('wordBank.helperSelect')
            : activeKey === null
              ? t('wordBank.helperIdle')
              : t('wordBank.helperArmed')}{' '}
          {t('wordBank.filledCount', { done: filled.length, total: blanks.length })}
        </p>
      )}
    </div>
  );
}

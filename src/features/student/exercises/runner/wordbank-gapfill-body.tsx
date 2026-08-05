'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';

import type {
  GapKey,
  ProjectedGapToken,
  StudentProjection,
} from '@/lib/shared-kernel/wordbank-gapfill';

import { Instr } from './instr';
import { modeAccentSoft, type RunnerMode, type RunnerPhase } from './types';

/** gapKey → the word the learner put there. A missing key is an empty gap. */
export type GapFillValue = Record<GapKey, string>;

/**
 * One gap's outcome, as the server decided it. The explanation is already resolved
 * there — the pair text for exactly the word chosen, else the gap's default, else the
 * note on why the answer is right. The client neither knows the rule nor needs to: it
 * has no answers to apply it to.
 */
export interface GapVerdict {
  correct: boolean;
  explanation: string | null;
}

export interface WordBankGapFillBodyProps {
  /**
   * The masked exercise as it left the server. It has no answers in it — the
   * gapped tokens were cut out server-side, and grading happens there too.
   */
  projection: StudentProjection;
  instruction?: string;
  value: GapFillValue;
  onValueChange: (value: GapFillValue) => void;
  /** Reports whether every gap is filled, which is what enables the primary action. */
  onAnswerChange: (allFilled: boolean) => void;
  phase: RunnerPhase;
  mode: RunnerMode;
  accent: string;
  /** Per-gap outcomes, present once the exercise has been checked at least once. */
  results?: Record<GapKey, GapVerdict>;
  /**
   * The answers, and only after the learner asks for them. A separate action rather
   * than a consequence of being wrong: attempts are unlimited, and a right answer
   * shown unbidden ends the exercise for them (BEHAVIOR §2.2).
   */
  revealed?: Record<GapKey, string>;
}

const READING = 'var(--ssz-font-reading)';
const OK_LINE = 'var(--ssz-feedback-ok-line)';
const OK_FG = 'var(--ssz-feedback-ok-fg)';
const NO_LINE = 'var(--ssz-feedback-no-line)';
const NO_FG = 'var(--ssz-feedback-no-fg)';
/** BEHAVIOR §3: a word chip is a real button, comfortably tappable. */
const CHIP_MIN_HEIGHT = 36;
/**
 * Every typed gap is the same width, in characters. Sizing one to its answer would
 * disclose the answer's length, which is a real hint in a language whose inflections
 * differ by a letter or two — «bil», «bilen», «bilene».
 */
const TYPED_GAP_WIDTH = 12;

const gapTokensOf = (projection: StudentProjection): ProjectedGapToken[] =>
  projection.sentences.flatMap((sentence) =>
    sentence.tokens.filter((token): token is ProjectedGapToken => token.kind === 'gap'),
  );

/**
 * The word bank gap-fill, as the learner plays it.
 *
 * Presentational and controlled on purpose: it is handed a projection and a set of
 * placements and hands back placements. It never knows an answer, never decides
 * whether one is right, and has nothing to compute a verdict from — which is what
 * makes it safe to render on a page that has not asked the server anything yet.
 */
export function WordBankGapFillBody({
  projection,
  instruction,
  value,
  onValueChange,
  onAnswerChange,
  phase,
  mode,
  accent,
  results,
  revealed,
}: WordBankGapFillBodyProps) {
  const t = useTranslations('ExerciseRunner');
  const isAnswering = phase === 'answering';
  /**
   * The learner types instead of choosing (plan decision 4). This is what absorbs the
   * old `fill_in_blank`: the grammar drills that never had a bank to choose from.
   */
  const isTyped = projection.settings.input === 'free';
  const gaps = useMemo(() => gapTokensOf(projection), [projection]);

  /**
   * The gap the next word lands in. Two-step placement is not a preference: one bank
   * serves every sentence, so a word tap has to know where it is going.
   */
  const [armedKey, setArmedKey] = useState<GapKey | null>(null);
  const gapRefs = useRef(new Map<GapKey, HTMLButtonElement | null>());

  const filledCount = gaps.filter((gap) => (value[gap.gapKey] ?? '') !== '').length;
  const allFilled = gaps.length > 0 && filledCount === gaps.length;

  useEffect(() => {
    onAnswerChange(allFilled);
  }, [allFilled, onAnswerChange]);

  /**
   * A word is spent once it sits in a gap — the textbook rule is one word, one gap,
   * and it is half of what the exercise teaches: using a word narrows the field.
   * Drills where one word answers several gaps opt out with `allowReuse`.
   */
  const spent = projection.settings.allowReuse
    ? new Set<string>()
    : new Set(Object.values(value).filter(Boolean));

  const isRevealed = revealed !== undefined;

  /**
   * A gap the learner got right is finished with. It stays locked through the next
   * attempt too (AC-S10): re-entering words already known to be right teaches nothing
   * and risks talking them out of a correct answer.
   */
  const isLocked = (key: GapKey): boolean => isRevealed || results?.[key]?.correct === true;

  const firstEmptyKey = (): GapKey | null =>
    gaps.find((gap) => (value[gap.gapKey] ?? '') === '' && !isLocked(gap.gapKey))?.gapKey ?? null;

  /** Where a word tap goes: the armed gap, or the first empty one (BEHAVIOR §2.1). */
  const targetKey = armedKey ?? firstEmptyKey();

  /** Keeps the flow going after a placement: arm the next gap still empty. */
  function nextEmptyAfter(key: GapKey): GapKey | null {
    const at = gaps.findIndex((gap) => gap.gapKey === key);
    const ordered = [...gaps.slice(at + 1), ...gaps.slice(0, Math.max(at, 0))];
    return (
      ordered.find((gap) => (value[gap.gapKey] ?? '') === '' && !isLocked(gap.gapKey))?.gapKey ??
      null
    );
  }

  function place(key: GapKey, word: string) {
    onValueChange({ ...value, [key]: word });
  }

  function clear(key: GapKey) {
    const next = { ...value };
    delete next[key];
    onValueChange(next);
  }

  function pickWord(word: string) {
    if (!isAnswering || targetKey === null || isLocked(targetKey)) return;

    // Tapping the word already in the armed gap takes it back out, which is the
    // only way to empty a gap without first arming another one.
    if (value[targetKey] === word) {
      clear(targetKey);
      setArmedKey(targetKey);
      return;
    }
    if (!projection.settings.allowReuse && spent.has(word) && value[targetKey] !== word) {
      // The chip is already somewhere else. Moving it means emptying that gap.
      const previous = gaps.find((gap) => value[gap.gapKey] === word);
      if (previous) {
        const next = { ...value };
        delete next[previous.gapKey];
        next[targetKey] = word;
        onValueChange(next);
        setArmedKey(nextEmptyAfter(targetKey));
        return;
      }
    }
    place(targetKey, word);
    setArmedKey(nextEmptyAfter(targetKey));
  }

  function tapGap(key: GapKey) {
    if (!isAnswering || isLocked(key)) return;
    // A filled gap gives its word back rather than arming: taking a word out is
    // the commoner intent, and arming a full gap does nothing visible.
    if ((value[key] ?? '') !== '') {
      clear(key);
      setArmedKey(key);
      return;
    }
    setArmedKey((current) => (current === key ? null : key));
  }

  /**
   * Green when right, red when wrong, accent while the gap is armed, plain otherwise.
   * Never colour alone: the verdict is also in the gap's accessible name and spelled
   * out in the feedback block beneath the sentence (AC-X7).
   */
  function gapTone(key: GapKey): { line: string; fg: string } {
    const verdict = results?.[key];
    if (isRevealed) return { line: OK_LINE, fg: OK_FG };
    if (verdict === undefined) {
      return {
        line: armedKey === key ? accent : 'var(--ssz-border-default)',
        fg: 'var(--ssz-text-primary)',
      };
    }
    return verdict.correct ? { line: OK_LINE, fg: OK_FG } : { line: NO_LINE, fg: NO_FG };
  }

  function gapLabel(key: GapKey, label: string): string {
    const answer = revealed?.[key];
    if (answer !== undefined) return t('gapFill.revealedGap', { label, word: answer });

    const word = value[key] ?? '';
    if (word === '') return t('gapFill.emptyGap', { label });

    const verdict = results?.[key];
    if (verdict === undefined) return t('gapFill.filledGap', { label, word });
    return verdict.correct
      ? t('gapFill.correctGap', { label, word })
      : t('gapFill.wrongGap', { label, word });
  }

  /**
   * Focus moves to the first thing the learner has to read after a check. Without it a
   * screen-reader user is left at the bottom of the page with a verdict they were never
   * told about (BEHAVIOR §2.2).
   */
  const firstFeedbackRef = useRef<HTMLDivElement | null>(null);
  const hasResults = results !== undefined;
  useEffect(() => {
    if (hasResults) firstFeedbackRef.current?.focus();
  }, [hasResults, revealed]);

  const remaining = projection.bank === null ? 0 : projection.bank.length - spent.size;

  return (
    <div>
      {instruction && <Instr>{instruction}</Instr>}

      {/* The reveal ends the attempt, so the bank has nothing left to offer. */}
      {projection.bank !== null && !isRevealed && (
        <div className="mb-6">
          {projection.settings.showBankCount && (
            <div
              className="mb-2 text-[12px] font-semibold text-(--ssz-text-muted)"
              aria-live="polite"
            >
              {t('gapFill.remaining', { count: remaining })}
            </div>
          )}

          <div
            className="flex flex-wrap gap-2 rounded-xl border border-(--ssz-border-default) px-4 py-3.5"
            role="group"
            aria-label={t('wordBank.bankLabel')}
          >
            {projection.bank.map((word) => {
              const inTarget = targetKey !== null && value[targetKey] === word;
              const isSpent = spent.has(word);
              return (
                <button
                  key={word}
                  type="button"
                  disabled={!isAnswering}
                  draggable={isAnswering && !isSpent}
                  onDragStart={(e) => e.dataTransfer.setData('text/plain', word)}
                  onClick={() => pickWord(word)}
                  aria-pressed={inTarget}
                  className="rounded-lg px-3 py-1 text-[14px] transition-opacity focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-(--ssz-border-focus)"
                  style={{
                    fontFamily: READING,
                    minHeight: CHIP_MIN_HEIGHT,
                    border: `1.5px solid ${inTarget ? accent : 'transparent'}`,
                    background: inTarget ? modeAccentSoft(mode) : 'var(--ssz-bg-muted)',
                    color: inTarget ? accent : 'var(--ssz-text-secondary)',
                    // Struck through as well as dimmed: colour alone would carry
                    // the whole message, which AC-X7 forbids.
                    opacity: isSpent ? 0.35 : 1,
                    textDecoration: isSpent ? 'line-through' : 'none',
                    cursor: isAnswering ? 'pointer' : 'default',
                  }}
                >
                  {word}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-4">
        {projection.sentences.map((sentence) => (
          <div key={sentence.id}>
            <p
              className="text-[16.5px] leading-[1.9]"
              style={{ fontFamily: READING, color: 'var(--ssz-text-primary)' }}
            >
              {sentence.tokens.map((token, i) =>
                token.kind === 'text' ? (
                  <span key={i}>{token.text} </span>
                ) : (
                  <span key={i}>
                    {token.before}
                    {isTyped ? (
                      <input
                        type="text"
                        value={revealed?.[token.gapKey] ?? value[token.gapKey] ?? ''}
                        onChange={(e) => place(token.gapKey, e.target.value)}
                        disabled={!isAnswering || isLocked(token.gapKey)}
                        aria-label={gapLabel(token.gapKey, token.label)}
                        // No autocorrect anywhere near this: a phone keyboard
                        // "fixing" a Norwegian inflection is the learner being
                        // marked wrong for the device's opinion.
                        autoCorrect="off"
                        autoCapitalize="off"
                        spellCheck={false}
                        className="mx-0.5 rounded-md px-2 align-baseline focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-(--ssz-border-focus)"
                        style={{
                          fontFamily: READING,
                          fontSize: 'inherit',
                          width: `${TYPED_GAP_WIDTH}ch`,
                          borderBottom: `2px solid ${gapTone(token.gapKey).line}`,
                          background: 'transparent',
                          color: gapTone(token.gapKey).fg,
                        }}
                      />
                    ) : (
                      <button
                        type="button"
                        ref={(el) => {
                          gapRefs.current.set(token.gapKey, el);
                        }}
                        disabled={!isAnswering || isLocked(token.gapKey)}
                        onClick={() => tapGap(token.gapKey)}
                        onDragOver={(e) => {
                          if (isAnswering) e.preventDefault();
                        }}
                        onDrop={(e) => {
                          if (!isAnswering || isLocked(token.gapKey)) return;
                          e.preventDefault();
                          const word = e.dataTransfer.getData('text/plain');
                          if (word) {
                            place(token.gapKey, word);
                            setArmedKey(null);
                          }
                        }}
                        aria-label={gapLabel(token.gapKey, token.label)}
                        className="mx-0.5 rounded-md px-2 align-baseline focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-(--ssz-border-focus)"
                        style={{
                          fontFamily: READING,
                          minWidth: 72,
                          borderBottom: `2px solid ${gapTone(token.gapKey).line}`,
                          background:
                            armedKey === token.gapKey && results?.[token.gapKey] === undefined
                              ? modeAccentSoft(mode)
                              : 'transparent',
                          color: gapTone(token.gapKey).fg,
                          cursor: isAnswering && !isLocked(token.gapKey) ? 'pointer' : 'default',
                        }}
                      >
                        {revealed?.[token.gapKey] ?? value[token.gapKey] ?? ' '}
                      </button>
                    )}
                    {token.after}{' '}
                  </span>
                ),
              )}
            </p>

            {/* The hint is help before the fact; once there is a verdict it is noise. */}
            {sentence.hint && !hasResults && (
              <p className="mt-1 text-[12.5px] text-(--ssz-text-muted)">{sentence.hint}</p>
            )}

            {hasResults &&
              sentence.tokens
                .filter((token): token is ProjectedGapToken => token.kind === 'gap')
                .map((token) => {
                  const verdict = results[token.gapKey];
                  if (verdict === undefined) return null;
                  const tone = verdict.correct
                    ? { line: OK_LINE, fg: OK_FG }
                    : { line: NO_LINE, fg: NO_FG };
                  const answer = revealed?.[token.gapKey];

                  return (
                    <div
                      key={token.gapKey}
                      ref={(el) => {
                        if (firstFeedbackRef.current === null && el !== null) {
                          firstFeedbackRef.current = el;
                        }
                      }}
                      tabIndex={-1}
                      role={verdict.correct ? undefined : 'alert'}
                      className="mt-2 rounded-lg border-l-2 px-3 py-2 text-[13.5px]"
                      style={{ borderColor: tone.line, background: 'var(--ssz-bg-muted)' }}
                    >
                      <span className="font-semibold" style={{ color: tone.fg }}>
                        {token.label}
                        {answer === undefined
                          ? ` — ${verdict.correct ? t('gapFill.right') : t('gapFill.wrong')}`
                          : ` — ${answer}`}
                      </span>
                      {verdict.explanation && (
                        <span style={{ color: 'var(--ssz-text-secondary)' }}>
                          {' '}
                          {verdict.explanation}
                        </span>
                      )}
                    </div>
                  );
                })}
          </div>
        ))}
      </div>

      <p className="mt-4 text-[12.5px] text-(--ssz-text-muted)" aria-live="polite">
        {armedKey === null ? t('wordBank.helperIdle') : t('wordBank.helperArmed')}
      </p>
    </div>
  );
}

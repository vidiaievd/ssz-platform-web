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
}

const READING = 'var(--ssz-font-reading)';
/** BEHAVIOR §3: a word chip is a real button, comfortably tappable. */
const CHIP_MIN_HEIGHT = 36;

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
}: WordBankGapFillBodyProps) {
  const t = useTranslations('ExerciseRunner');
  const isAnswering = phase === 'answering';
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

  const firstEmptyKey = (): GapKey | null =>
    gaps.find((gap) => (value[gap.gapKey] ?? '') === '')?.gapKey ?? null;

  /** Where a word tap goes: the armed gap, or the first empty one (BEHAVIOR §2.1). */
  const targetKey = armedKey ?? firstEmptyKey();

  /** Keeps the flow going after a placement: arm the next gap still empty. */
  function nextEmptyAfter(key: GapKey): GapKey | null {
    const at = gaps.findIndex((gap) => gap.gapKey === key);
    const ordered = [...gaps.slice(at + 1), ...gaps.slice(0, Math.max(at, 0))];
    return ordered.find((gap) => (value[gap.gapKey] ?? '') === '')?.gapKey ?? null;
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
    if (!isAnswering || targetKey === null) return;

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
    if (!isAnswering) return;
    // A filled gap gives its word back rather than arming: taking a word out is
    // the commoner intent, and arming a full gap does nothing visible.
    if ((value[key] ?? '') !== '') {
      clear(key);
      setArmedKey(key);
      return;
    }
    setArmedKey((current) => (current === key ? null : key));
  }

  const remaining = projection.bank === null ? 0 : projection.bank.length - spent.size;

  return (
    <div>
      {instruction && <Instr>{instruction}</Instr>}

      {projection.bank !== null && (
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
                    <button
                      type="button"
                      ref={(el) => {
                        gapRefs.current.set(token.gapKey, el);
                      }}
                      disabled={!isAnswering}
                      onClick={() => tapGap(token.gapKey)}
                      onDragOver={(e) => {
                        if (isAnswering) e.preventDefault();
                      }}
                      onDrop={(e) => {
                        if (!isAnswering) return;
                        e.preventDefault();
                        const word = e.dataTransfer.getData('text/plain');
                        if (word) {
                          place(token.gapKey, word);
                          setArmedKey(null);
                        }
                      }}
                      aria-label={
                        (value[token.gapKey] ?? '') === ''
                          ? t('gapFill.emptyGap', { label: token.label })
                          : t('gapFill.filledGap', {
                              label: token.label,
                              word: value[token.gapKey] ?? '',
                            })
                      }
                      className="mx-0.5 rounded-md px-2 align-baseline focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-(--ssz-border-focus)"
                      style={{
                        fontFamily: READING,
                        minWidth: 72,
                        borderBottom: `2px solid ${armedKey === token.gapKey ? accent : 'var(--ssz-border-default)'}`,
                        background:
                          armedKey === token.gapKey ? modeAccentSoft(mode) : 'transparent',
                        color: 'var(--ssz-text-primary)',
                        cursor: isAnswering ? 'pointer' : 'default',
                      }}
                    >
                      {value[token.gapKey] ?? ' '}
                    </button>
                    {token.after}{' '}
                  </span>
                ),
              )}
            </p>

            {sentence.hint && (
              <p className="mt-1 text-[12.5px] text-(--ssz-text-muted)">{sentence.hint}</p>
            )}
          </div>
        ))}
      </div>

      <p className="mt-4 text-[12.5px] text-(--ssz-text-muted)" aria-live="polite">
        {armedKey === null ? t('wordBank.helperIdle') : t('wordBank.helperArmed')}
      </p>
    </div>
  );
}

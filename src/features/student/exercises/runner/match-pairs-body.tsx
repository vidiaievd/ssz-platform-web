'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';

import type { PairId, RightId, StudentProjection } from '@/lib/shared-kernel/match-pairs';

import { Instr } from './instr';
import { modeAccentSoft, type RunnerMode, type RunnerPhase } from './types';

/** slotId → the pool item the learner put there. A missing key is an empty slot. */
export type MatchPairsValue = Record<PairId, RightId>;

/**
 * One slot's outcome, as the server decided it. The explanation is already resolved
 * there — the teacher's note for exactly the half attached, else the pair's default.
 * The client neither knows the rule nor could apply it: it holds no answers.
 */
export interface SlotVerdict {
  correct: boolean;
  explanation: string | null;
}

/** What the reveal put into a slot: the half that belonged there, and why. */
export interface RevealedSlot {
  rightId: RightId;
  text: string;
  why: string | null;
}

export interface MatchPairsBodyProps {
  /**
   * The projected exercise as it left the server: left halves as slots, a flat pool
   * of right halves. Which pool items are answers is not in here — that is the point.
   */
  projection: StudentProjection;
  instruction?: string;
  value: MatchPairsValue;
  onValueChange: (value: MatchPairsValue) => void;
  /** Reports whether at least one slot is filled, which is what enables the check. */
  onAnswerChange: (canCheck: boolean) => void;
  phase: RunnerPhase;
  mode: RunnerMode;
  accent: string;
  /** Per-slot outcomes, present once the exercise has been checked at least once. */
  results?: Record<PairId, SlotVerdict>;
  /**
   * Whether the verdicts are being read or worked from. They outlive the feedback
   * that explained them: a correct slot keeps its verdict for as long as it keeps its
   * lock, while the explanation is spent as soon as the learner goes back to matching.
   */
  showFeedback?: boolean;
  /** Set while the runner is pointing out that no slot has been filled yet. */
  pointOut?: boolean;
  /** The answers, and only after the learner asks for them. */
  revealed?: Record<PairId, RevealedSlot>;
}

const READING = 'var(--ssz-font-reading)';
const OK_BG = 'var(--ssz-feedback-ok-bg)';
const OK_LINE = 'var(--ssz-feedback-ok-line)';
const OK_FG = 'var(--ssz-feedback-ok-fg)';
const NO_BG = 'var(--ssz-feedback-no-bg)';
const NO_LINE = 'var(--ssz-feedback-no-line)';
const NO_FG = 'var(--ssz-feedback-no-fg)';
/** BEHAVIOR §3: every target is comfortably tappable. */
const TAP_MIN = 44;

/** 0 → "A", 25 → "Z", 26 → "AA" — the pool's labels in `halves`. */
function letterLabel(index: number): string {
  let label = '';
  let n = index;
  do {
    label = String.fromCharCode(65 + (n % 26)) + label;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return label;
}

/**
 * `match_pairs`, as the learner plays it — slots stacked above a pool of right halves.
 *
 * **Not two columns.** The old body put left and right items side by side, which works
 * only while the two sides are the same length and the same shape. Neither survives
 * this template's new form: the pool carries distractors, so it is strictly longer than
 * the list of slots, and in `halves` each side is a clause rather than a word. Rows the
 * full width of the column, with the pool wrapping underneath, takes both — and the
 * pool being visibly longer is the point, since it is what stops the last slot from
 * solving itself by elimination.
 *
 * Presentational and controlled, like the gap-fill body: handed a projection and a set
 * of placements, hands back placements. It never knows an answer and never decides
 * whether one is right, which is what makes it safe to render before the server has
 * been asked anything.
 *
 * Three ways in, all of which end in the same placement (BEHAVIOR §2.1):
 * slot-then-half, half-then-slot, and dragging a half onto a slot on a pointer device.
 */
export function MatchPairsBody({
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
  showFeedback = true,
  pointOut = false,
}: MatchPairsBodyProps) {
  const t = useTranslations('ExerciseRunner');
  const isAnswering = phase === 'answering';
  const isRevealed = revealed !== undefined;
  const { slots, pool, variant } = projection;

  /**
   * Whichever end the learner armed first. One of the two is always null: arming a slot
   * and arming a half are the same gesture seen from opposite sides, and holding both
   * would mean a placement had been made without either tap completing it.
   */
  const [armedSlot, setArmedSlot] = useState<PairId | null>(null);
  const [armedItem, setArmedItem] = useState<RightId | null>(null);
  const slotRefs = useRef(new Map<PairId, HTMLButtonElement | null>());

  const itemToSlot = useMemo(() => {
    const out: Record<RightId, PairId> = {};
    for (const [slotId, itemId] of Object.entries(value)) out[itemId] = slotId;
    return out;
  }, [value]);
  const poolText = useMemo(
    () => new Map(pool.map((item) => [item.itemId, item.text])),
    [pool],
  );
  const poolLabel = useMemo(
    () => new Map(pool.map((item, i) => [item.itemId, letterLabel(i)])),
    [pool],
  );

  const filledCount = slots.filter((slot) => value[slot.slotId] !== undefined).length;
  const canCheck = filledCount > 0;

  useEffect(() => {
    onAnswerChange(canCheck);
  }, [canCheck, onAnswerChange]);

  /** A slot whose verdict is `correct` is settled and stops accepting halves (AC-S9). */
  const isLocked = (slotId: PairId): boolean =>
    isRevealed || results?.[slotId]?.correct === true;

  /**
   * Placing `itemId` into `slotId`. The half leaves whatever slot held it before —
   * a half belongs to exactly one slot, and silently duplicating it would let a pool
   * of eight fill five slots with three halves.
   */
  function place(slotId: PairId, itemId: RightId) {
    const next: MatchPairsValue = {};
    for (const [slot, item] of Object.entries(value)) {
      if (slot === slotId || item === itemId) continue;
      next[slot] = item;
    }
    // Re-placing the half already in this slot takes it back out.
    if (value[slotId] !== itemId) next[slotId] = itemId;
    onValueChange(next);
    setArmedSlot(null);
    setArmedItem(null);
  }

  function clearSlot(slotId: PairId) {
    const next = { ...value };
    delete next[slotId];
    onValueChange(next);
  }

  function onSlotPress(slotId: PairId) {
    if (!isAnswering || isLocked(slotId)) return;
    if (armedItem !== null) {
      place(slotId, armedItem);
      return;
    }
    // A filled slot gives its half back rather than arming: emptying it is the only
    // other thing there is to do here, and it takes one tap either way.
    if (value[slotId] !== undefined) {
      clearSlot(slotId);
      setArmedSlot(null);
      return;
    }
    setArmedSlot((current) => (current === slotId ? null : slotId));
  }

  function onItemPress(itemId: RightId) {
    if (!isAnswering) return;
    if (armedSlot !== null) {
      place(armedSlot, itemId);
      return;
    }
    // A half that is already placed re-arms with its slot in hand, so the next tap
    // moves it rather than doing nothing.
    const owner = itemToSlot[itemId];
    if (owner !== undefined && !isLocked(owner)) {
      setArmedItem(itemId);
      setArmedSlot(null);
      return;
    }
    if (owner !== undefined) return;
    setArmedItem((current) => (current === itemId ? null : itemId));
  }

  const helper =
    armedSlot !== null
      ? t('matchPairs.helperSlotArmed')
      : armedItem !== null
        ? t('matchPairs.helperItemArmed')
        : t('matchPairs.helperIdle');

  return (
    <div>
      {instruction !== undefined && <Instr>{instruction}</Instr>}

      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {slots.map((slot, index) => {
          const itemId = value[slot.slotId];
          const verdict = showFeedback ? results?.[slot.slotId] : undefined;
          const reveal = revealed?.[slot.slotId];
          const locked = isLocked(slot.slotId);
          const armed = armedSlot === slot.slotId;
          const empty = itemId === undefined && reveal === undefined;

          const tone =
            verdict === undefined
              ? null
              : verdict.correct
                ? { bg: OK_BG, line: OK_LINE, fg: OK_FG }
                : { bg: NO_BG, line: NO_LINE, fg: NO_FG };

          return (
            <li key={slot.slotId}>
              <button
                type="button"
                ref={(node) => {
                  slotRefs.current.set(slot.slotId, node);
                }}
                onClick={() => onSlotPress(slot.slotId)}
                onDragOver={(event) => {
                  if (!isAnswering || locked) return;
                  event.preventDefault();
                }}
                onDrop={(event) => {
                  if (!isAnswering || locked) return;
                  event.preventDefault();
                  const dropped = event.dataTransfer.getData('text/plain');
                  if (dropped !== '') place(slot.slotId, dropped);
                }}
                aria-disabled={!isAnswering || locked}
                aria-label={
                  // What the slot announces is what it shows. After a reveal that is
                  // the answer, not the empty slot underneath it — a screen reader
                  // told "no half chosen" while the answer sits on the line is being
                  // told the wrong thing about the same button.
                  reveal !== undefined
                    ? t('matchPairs.revealedSlot', { left: slot.left, half: reveal.text })
                    : itemId === undefined
                      ? t('matchPairs.emptySlot', { left: slot.left })
                      : t('matchPairs.filledSlot', {
                          left: slot.left,
                          half: poolText.get(itemId) ?? '',
                        })
                }
                className="flex w-full flex-col items-start gap-1 rounded-xl border px-4 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ssz-border-focus)"
                style={{
                  minHeight: TAP_MIN,
                  background: tone?.bg ?? (armed ? modeAccentSoft(mode) : 'var(--ssz-bg-surface)'),
                  borderColor:
                    tone?.line ??
                    (armed
                      ? accent
                      : pointOut && !canCheck
                        ? 'var(--ssz-feedback-no-line)'
                        : 'var(--ssz-border-default)'),
                  cursor: isAnswering && !locked ? 'pointer' : 'default',
                }}
              >
                <span className="flex w-full items-baseline gap-2">
                  {variant === 'halves' && (
                    <span
                      aria-hidden="true"
                      className="shrink-0 text-[12.5px] font-bold"
                      style={{ color: 'var(--ssz-text-muted)' }}
                    >
                      {index + 1}.
                    </span>
                  )}
                  <span
                    className="text-[15px] leading-[1.45]"
                    style={{
                      fontFamily: variant === 'halves' ? READING : undefined,
                      color: 'var(--ssz-text-primary)',
                    }}
                  >
                    {slot.left}
                  </span>
                </span>

                <span
                  className="text-[14.5px] leading-[1.45]"
                  style={{
                    fontFamily: variant === 'halves' ? READING : undefined,
                    color: empty ? 'var(--ssz-text-muted)' : (tone?.fg ?? 'var(--ssz-text-primary)'),
                    fontStyle: empty ? 'italic' : undefined,
                  }}
                >
                  {reveal !== undefined
                    ? reveal.text
                    : itemId !== undefined
                      ? (poolText.get(itemId) ?? '')
                      : t('matchPairs.tapAHalf')}
                </span>
              </button>

              {/* The teacher's note on the half actually attached — never the half that
                  should have been. Being wrong explains; it does not hand over. */}
              {verdict !== undefined && !verdict.correct && verdict.explanation !== null && (
                <p className="mt-1 px-4 text-[13px] leading-[1.5]" style={{ color: NO_FG }}>
                  {verdict.explanation}
                </p>
              )}

              {reveal?.why != null && reveal.why !== '' && (
                <p
                  className="mt-1 px-4 text-[13px] leading-[1.5]"
                  style={{ color: 'var(--ssz-text-secondary)' }}
                >
                  {reveal.why}
                </p>
              )}
            </li>
          );
        })}
      </ul>

      {isAnswering && (
        <>
          {projection.settings.showRemaining && (
            <p className="mt-4 mb-1 text-[12.5px] font-semibold" style={{ color: 'var(--ssz-text-muted)' }}>
              {t('matchPairs.remaining', { count: slots.length - filledCount })}
            </p>
          )}
          <p aria-live="polite" className="sr-only">
            {helper}
          </p>
        </>
      )}

      {/* The pool stays on screen through the feedback phase so a wrong slot can be
          corrected without the halves disappearing out from under the explanation. */}
      <div className="mt-3 flex flex-wrap gap-2">
        {pool.map((item) => {
          const owner = itemToSlot[item.itemId];
          const used = owner !== undefined;
          const armed = armedItem === item.itemId;
          return (
            <button
              key={item.itemId}
              type="button"
              draggable={isAnswering && !used}
              onDragStart={(event) => {
                event.dataTransfer.setData('text/plain', item.itemId);
                event.dataTransfer.effectAllowed = 'move';
              }}
              onClick={() => onItemPress(item.itemId)}
              aria-disabled={!isAnswering}
              aria-pressed={armed}
              className="rounded-lg border px-3 py-2 text-left text-[14px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ssz-border-focus)"
              style={{
                minHeight: TAP_MIN,
                fontFamily: variant === 'halves' ? READING : undefined,
                background: armed ? modeAccentSoft(mode) : 'var(--ssz-bg-surface)',
                borderColor: armed ? accent : 'var(--ssz-border-default)',
                color: 'var(--ssz-text-primary)',
                // Used halves stay in place rather than vanishing: a pool that
                // reflows on every placement makes the one you wanted hard to find
                // again, and the count of what is left is the real signal anyway.
                opacity: used ? 0.35 : 1,
                cursor: isAnswering ? 'pointer' : 'default',
              }}
            >
              {variant === 'halves' && (
                <span
                  aria-hidden="true"
                  className="mr-1.5 text-[12.5px] font-bold"
                  style={{ color: 'var(--ssz-text-muted)' }}
                >
                  {poolLabel.get(item.itemId)}.
                </span>
              )}
              {item.text}
            </button>
          );
        })}
      </div>
    </div>
  );
}

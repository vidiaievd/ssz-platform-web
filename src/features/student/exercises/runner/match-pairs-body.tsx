'use client';

import { CheckCircle, X, XCircle } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';

import { useContainerWidth } from '@/hooks';
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
  /**
   * Drops one slot's mark, when the learner edits that slot after a check (AC-S11).
   * The body cannot do it itself — the verdicts belong to the check that produced
   * them, and the runner owns those — but it is the only thing that knows an edit
   * happened.
   */
  onClearMark?: (slotId: PairId) => void;
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
/**
 * The width, in px, at which the pool earns a column of its own: 20rem for the
 * pool plus enough left for a sentence to read as a sentence.
 */
const POOL_COLUMN_AT = 672;

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
 * `match_pairs`, as the learner plays it — BEHAVIOR §2, one component, two layouts.
 *
 * **Wide**: two columns, slot rows on the left and the whole pool as a stack of chips
 * on the right, all of it visible at once. That is what this exercise wants — the
 * halves are compared against each other, and distractors only work if you can see
 * what you are ruling out.
 *
 * **Narrow**: the pool has nowhere to live. Eight halves, each a clause long, is four
 * hundred pixels of chips; parked at the bottom of a phone they left the sentences a
 * sliver to share and the exercise could not be done at all. So on a phone the pool is
 * not parked anywhere — tapping a sentence opens the halves directly underneath it,
 * and choosing one closes them again. One decision on screen at a time, with the other
 * sentences still a scroll away, which keeps elimination possible.
 *
 * "Room" is this component's **own** width, not the window's (`useContainerWidth`).
 * The teacher's preview is a 284px phone frame on a desktop screen, and a body that
 * asks the window how wide it is cannot be embedded — which is exactly what the
 * preview does to it.
 *
 * Note what the two columns are and are not. They are *slots* and *pool*, which is why
 * distractors do not disturb them — the pool column is simply taller. The layout this
 * replaced put left items against right items as matched rows, which only worked while
 * the two sides were the same length; that is the arrangement distractors break, not
 * this one.
 *
 * Presentational and controlled, like the gap-fill body: handed a projection and a set
 * of placements, hands back placements. It never knows an answer and never decides
 * whether one is right, which is what makes it safe to render before the server has
 * been asked anything.
 */
export function MatchPairsBody({
  projection,
  instruction,
  value,
  onValueChange,
  onAnswerChange,
  onClearMark,
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
  const [dragOverSlot, setDragOverSlot] = useState<PairId | null>(null);
  const firstAlert = useRef<HTMLParagraphElement | null>(null);
  const [root, width] = useContainerWidth();
  const poolHasColumn = width >= POOL_COLUMN_AT;
  const openPicker = useRef<HTMLDivElement | null>(null);

  const itemToSlot = useMemo(() => {
    const out: Record<RightId, PairId> = {};
    for (const [slotId, itemId] of Object.entries(value)) out[itemId] = slotId;
    return out;
  }, [value]);
  const poolText = useMemo(() => new Map(pool.map((item) => [item.itemId, item.text])), [pool]);
  const poolLabel = useMemo(
    () => new Map(pool.map((item, i) => [item.itemId, letterLabel(i)])),
    [pool],
  );

  /**
   * The slot whose explanation takes focus after a check — derived rather than
   * tracked while rendering, so it is the same answer on every pass. First in slot
   * order, which is reading order.
   */
  const firstAlertSlot = useMemo(() => {
    if (!showFeedback || results === undefined) return null;
    const found = slots.find((slot) => {
      const verdict = results[slot.slotId];
      return verdict !== undefined && !verdict.correct && verdict.explanation !== null;
    });
    return found?.slotId ?? null;
  }, [showFeedback, results, slots]);

  const filledCount = slots.filter((slot) => value[slot.slotId] !== undefined).length;
  const canCheck = filledCount > 0;

  useEffect(() => {
    onAnswerChange(canCheck);
  }, [canCheck, onAnswerChange]);

  /**
   * BEHAVIOR §3: focus moves to the first explanation after a check. Without it the
   * verdict is announced nowhere — the marks are visual, and a screen reader user
   * would be left on the button they just pressed with the page silently rearranged.
   */
  useEffect(() => {
    if (firstAlertSlot !== null) firstAlert.current?.focus();
  }, [firstAlertSlot]);

  /**
   * The halves a phone opens under the last sentence are otherwise below the fold.
   * On opening only — scrolling on every render would fight the reader's own thumb.
   */
  useEffect(() => {
    if (armedSlot !== null && !poolHasColumn) {
      openPicker.current?.scrollIntoView({ block: 'nearest' });
    }
  }, [armedSlot, poolHasColumn]);

  /** A slot whose verdict is `correct` is settled and stops accepting halves (AC-S8). */
  const isLocked = (slotId: PairId): boolean => isRevealed || results?.[slotId]?.correct === true;

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
    // The slot the half came from is being edited too, so its mark goes as well.
    const vacated = itemToSlot[itemId];
    if (vacated !== undefined && vacated !== slotId) onClearMark?.(vacated);
    onClearMark?.(slotId);
    setArmedSlot(null);
    setArmedItem(null);
  }

  function clearSlot(slotId: PairId) {
    const next = { ...value };
    delete next[slotId];
    onValueChange(next);
    // AC-S11: editing a slot clears that slot's mark, and only that one.
    onClearMark?.(slotId);
  }

  function onSlotPress(slotId: PairId) {
    if (!isAnswering || isLocked(slotId)) return;
    if (armedItem !== null) {
      place(slotId, armedItem);
      return;
    }
    setArmedSlot((current) => (current === slotId ? null : slotId));
  }

  function onItemPress(itemId: RightId) {
    if (!isAnswering) return;
    // AC-S6: a half already in a slot is spent — it does not respond until the slot
    // holding it gives it back.
    if (itemToSlot[itemId] !== undefined) return;
    if (armedSlot !== null) {
      place(armedSlot, itemId);
      return;
    }
    setArmedItem((current) => (current === itemId ? null : itemId));
  }

  const helper =
    armedSlot !== null
      ? t('matchPairs.helperSlotArmed')
      : armedItem !== null
        ? t('matchPairs.helperItemArmed')
        : t('matchPairs.helperIdle');

  // AC-S18: an exercise with no pairs is a thing to say, not an empty frame to render.
  if (slots.length === 0) {
    return (
      <div>
        {instruction !== undefined && <Instr>{instruction}</Instr>}
        <p
          className="rounded-xl border border-dashed px-4 py-8 text-center text-[14px]"
          style={{ borderColor: 'var(--ssz-border-default)', color: 'var(--ssz-text-muted)' }}
        >
          {t('matchPairs.noPairs')}
        </p>
      </div>
    );
  }

  /**
   * The halves, as buttons. The same list in both layouts: a column beside the
   * sentences where there is room, and the picker under one sentence where there is
   * not. Used halves stay in place rather than vanishing — a pool that reflows on
   * every placement makes the one you wanted hard to find again, and the count of
   * what is left is the real signal anyway.
   */
  function renderPool(as: 'column' | 'picker') {
    return (
      <div className={as === 'column' ? 'flex flex-col gap-2' : 'flex flex-col gap-1.5'}>
        {pool.map((item) => {
          const used = itemToSlot[item.itemId] !== undefined;
          const armed = armedItem === item.itemId;
          return (
            <button
              key={item.itemId}
              type="button"
              draggable={as === 'column' && isAnswering && !used}
              onDragStart={(event) => {
                event.dataTransfer.setData('text/plain', item.itemId);
                event.dataTransfer.effectAllowed = 'move';
              }}
              onClick={() => onItemPress(item.itemId)}
              aria-disabled={!isAnswering || used}
              aria-pressed={armed}
              className="w-full rounded-lg border px-3 py-2 text-left text-[14px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ssz-border-focus)"
              style={{
                minHeight: TAP_MIN,
                fontFamily: variant === 'halves' ? READING : undefined,
                background: armed ? modeAccentSoft(mode) : 'var(--ssz-bg-surface)',
                borderColor: armed ? accent : 'var(--ssz-border-default)',
                color: 'var(--ssz-text-primary)',
                opacity: used ? 0.32 : 1,
                cursor: isAnswering && !used ? 'pointer' : 'default',
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
    );
  }

  const remaining = isAnswering && projection.settings.showRemaining && (
    <p className="mb-1.5 text-[12.5px] font-semibold" style={{ color: 'var(--ssz-text-muted)' }}>
      {t('matchPairs.remaining', { count: slots.length - filledCount })}
    </p>
  );

  return (
    <div ref={root}>
      {instruction !== undefined && <Instr>{instruction}</Instr>}

      {/* On a phone the count belongs with the sentences; beside a pool column it
          belongs with the pool, which is what it counts down. */}
      {!poolHasColumn && remaining}
      {isAnswering && (
        <p aria-live="polite" className="sr-only">
          {helper}
        </p>
      )}

      <div
        className={
          poolHasColumn ? 'grid grid-cols-[minmax(0,1fr)_minmax(0,20rem)] items-start gap-6' : ''
        }
      >
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {slots.map((slot, index) => {
            const itemId = value[slot.slotId];
            const verdict = showFeedback ? results?.[slot.slotId] : undefined;
            const reveal = revealed?.[slot.slotId];
            const locked = isLocked(slot.slotId);
            const armed = armedSlot === slot.slotId;
            const dragOver = dragOverSlot === slot.slotId;
            const empty = itemId === undefined && reveal === undefined;
            const showClear = isAnswering && itemId !== undefined && !locked;

            const tone =
              verdict === undefined
                ? null
                : verdict.correct
                  ? { bg: OK_BG, line: OK_LINE, fg: OK_FG }
                  : { bg: NO_BG, line: NO_LINE, fg: NO_FG };

            // AC-X7: the mark is never colour alone — an icon and a word ride with it.
            const stateWord =
              verdict === undefined
                ? null
                : verdict.correct
                  ? t('matchPairs.stateCorrect')
                  : t('matchPairs.stateWrong');

            const label =
              reveal !== undefined
                ? t('matchPairs.revealedSlot', { left: slot.left, half: reveal.text })
                : itemId === undefined
                  ? t('matchPairs.emptySlot', { left: slot.left })
                  : verdict === undefined
                    ? t('matchPairs.filledSlot', {
                        left: slot.left,
                        half: poolText.get(itemId) ?? '',
                      })
                    : t(
                        verdict.correct
                          ? 'matchPairs.filledSlotCorrect'
                          : 'matchPairs.filledSlotWrong',
                        { left: slot.left, half: poolText.get(itemId) ?? '' },
                      );

            const isFirstAlert = slot.slotId === firstAlertSlot;

            return (
              <li key={slot.slotId}>
                {/* A div rather than a button: the clear control is a real button and
                    HTML forbids nesting one inside another. BEHAVIOR §3 asks for
                    role="button" with Enter/Space here for exactly this reason. */}
                <div
                  role="button"
                  tabIndex={isAnswering && !locked ? 0 : -1}
                  onClick={() => onSlotPress(slot.slotId)}
                  onKeyDown={(event) => {
                    if (event.key === 'Escape' && armed) {
                      setArmedSlot(null);
                      return;
                    }
                    if (event.key !== 'Enter' && event.key !== ' ') return;
                    event.preventDefault();
                    onSlotPress(slot.slotId);
                  }}
                  onDragOver={(event) => {
                    if (!isAnswering || locked) return;
                    event.preventDefault();
                    setDragOverSlot(slot.slotId);
                  }}
                  onDragLeave={() => setDragOverSlot(null)}
                  onDrop={(event) => {
                    setDragOverSlot(null);
                    if (!isAnswering || locked) return;
                    event.preventDefault();
                    const dropped = event.dataTransfer.getData('text/plain');
                    if (dropped !== '') place(slot.slotId, dropped);
                  }}
                  aria-disabled={!isAnswering || locked}
                  aria-label={label}
                  // Only where tapping a sentence opens something: with a pool
                  // column there is nothing to expand.
                  {...(poolHasColumn || !isAnswering || locked
                    ? {}
                    : { 'aria-expanded': armed, 'aria-controls': `picker-${slot.slotId}` })}
                  className="flex w-full items-start gap-2 rounded-xl border px-4 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ssz-border-focus)"
                  style={{
                    minHeight: TAP_MIN,
                    background:
                      tone?.bg ?? (armed || dragOver ? modeAccentSoft(mode) : 'var(--ssz-bg-surface)'),
                    borderColor:
                      tone?.line ??
                      (armed || dragOver
                        ? accent
                        : pointOut && !canCheck
                          ? NO_LINE
                          : 'var(--ssz-border-default)'),
                    borderStyle: empty && !armed && !dragOver ? 'dashed' : 'solid',
                    cursor: isAnswering && !locked ? 'pointer' : 'default',
                  }}
                >
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
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

                    <span className="flex items-center gap-1.5">
                      {verdict !== undefined &&
                        (verdict.correct ? (
                          <CheckCircle aria-hidden="true" size={15} style={{ color: OK_FG }} />
                        ) : (
                          <XCircle aria-hidden="true" size={15} style={{ color: NO_FG }} />
                        ))}
                      <span
                        className="text-[14.5px] leading-[1.45]"
                        style={{
                          fontFamily: variant === 'halves' ? READING : undefined,
                          color: empty
                            ? 'var(--ssz-text-muted)'
                            : (tone?.fg ?? 'var(--ssz-text-primary)'),
                          fontStyle: empty ? 'italic' : undefined,
                        }}
                      >
                        {reveal !== undefined
                          ? reveal.text
                          : itemId !== undefined
                            ? (poolText.get(itemId) ?? '')
                            : t('matchPairs.tapAHalf')}
                      </span>
                      {stateWord !== null && (
                        <span
                          className="text-[12px] font-bold uppercase tracking-[0.05em]"
                          style={{ color: tone?.fg }}
                        >
                          {stateWord}
                        </span>
                      )}
                    </span>
                  </span>

                  {/* AC-S5. A filled, unchecked slot gives its half back from here. */}
                  {showClear && (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        clearSlot(slot.slotId);
                      }}
                      aria-label={t('matchPairs.removeHalf', {
                        half: poolText.get(itemId) ?? '',
                      })}
                      className="shrink-0 rounded-md p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ssz-border-focus)"
                      style={{ color: 'var(--ssz-text-muted)' }}
                    >
                      <X aria-hidden="true" size={16} />
                    </button>
                  )}
                </div>

                {/* The halves, where there is no room for a column of them: under the
                    sentence being answered, and only that one. Two things stay on
                    screen together — the sentence and its candidates — which is the
                    comparison this exercise is made of. */}
                {!poolHasColumn && armed && isAnswering && !locked && (
                  <div
                    id={`picker-${slot.slotId}`}
                    role="group"
                    aria-label={t('matchPairs.pickerLabel', { left: slot.left })}
                    ref={openPicker}
                    className="mt-1.5 rounded-xl border border-dashed p-2"
                    style={{ borderColor: 'var(--ssz-border-default)' }}
                  >
                    {renderPool('picker')}
                  </div>
                )}

                {/* The teacher's note on the half actually attached — never the half
                    that should have been. Being wrong explains; it does not hand over. */}
                {verdict !== undefined && !verdict.correct && verdict.explanation !== null && (
                  <p
                    role="alert"
                    tabIndex={-1}
                    ref={isFirstAlert ? firstAlert : undefined}
                    className="mt-1 px-4 text-[13px] leading-[1.5] focus-visible:outline-none"
                    style={{ color: NO_FG }}
                  >
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

        {/* The pool gets a column only where one fits. On a phone it is rendered
            inside the sentence being answered — see `renderPool` above. */}
        {poolHasColumn && (
          <div>
            {remaining}
            {renderPool('column')}
          </div>
        )}
      </div>
    </div>
  );
}

'use client';

import {
  Ban,
  Check,
  CheckSquare,
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
  Clock,
  Image as ImageIcon,
  TriangleAlert,
  Wand2,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';

import {
  words as splitWords,
  type StudentProjection,
  type TextLength,
} from '@/lib/shared-kernel/writing-task';

import { Instr } from './instr';
import { modeAccentSoft, type RunnerMode } from './types';

/** What the learner sends: the text, and which checklist items they ticked off. */
export interface WritingTaskValue {
  text: string;
  ticked: string[];
}

/**
 * The three phases of the handoff's state machine (README, "State machine").
 *
 * Deliberately not `RunnerPhase`: the shared phase is `answering | feedback`, and a
 * written text has no feedback phase — it has a wait for a person. `sent` is that wait,
 * and it is a state the learner can leave the screen in and come back to.
 */
export type WritingTaskPhase = 'draft' | 'sent' | 'graded';

/** What the autosave line says, or nothing at all before the first save. */
export type DraftSaveState = 'idle' | 'saving' | 'saved';

/** Why the primary is disabled — or, when it is not, what the note says anyway. */
export type SubmitBlock = 'empty' | 'short' | 'long' | null;

export interface SubmitGate {
  canSubmit: boolean;
  /** `null` means nothing stands in the way; the note is then the standing reminder. */
  block: SubmitBlock;
  /** Words still needed, for the `short` note. */
  remaining: number;
}

export interface WritingTaskBodyProps {
  /** The task as the server projected it — never the stored document (it holds the key). */
  task: StudentProjection;
  value: WritingTaskValue;
  onValueChange: (value: WritingTaskValue) => void;
  /** The submit gate, recomputed whenever the text changes. The footer draws from it. */
  onGateChange?: (gate: SubmitGate) => void;
  phase: WritingTaskPhase;
  /** Which try this is. From the second on, the mode badge says so. */
  attemptNo?: number;
  /** False in a preview or a read-only replay: the surfaces render, nothing accepts input. */
  interactive?: boolean;
  /** What the autosave line shows. Owned by the caller, which is what actually saves. */
  saveState?: DraftSaveState;
  /**
   * The picture for `mode: 'picture'`, already resolved to a URL.
   *
   * The projection carries `image.assetId`, not an address: turning one into the other is
   * a call to media-service, and a presentational body that fetched would render an empty
   * frame on every screen that has the asset already. The caller resolves it; a `null`
   * here draws the placeholder, which is also what an author who has not chosen a picture
   * yet sees in the preview.
   */
  imageUrl?: string | null;
  mode?: RunnerMode;
  accent: string;
}

const READING = 'var(--ssz-font-reading)';
/** BEHAVIOR §7: the paste explanation is a message, not an error — it clears itself. */
const PASTE_NOTICE_MS = 2600;
/** The countdown turns amber here, and announces itself once (README, accessibility). */
const TIMER_WARN_S = 300;

/**
 * How the text stands against the author's range.
 *
 * The same four states the server computes in `analyse`, from the same tokeniser, for
 * one reason: the runner's gate and the queue's readout must not disagree about how many
 * words a text has. Everything else `analyse` produces needs the point keywords, which
 * the projection deliberately does not carry.
 */
export function measure(
  settings: Pick<StudentProjection['settings'], 'minWords' | 'maxWords'>,
  text: string,
): { words: number; length: TextLength } {
  const count = splitWords(text).length;
  const length: TextLength =
    count === 0
      ? 'empty'
      : count < settings.minWords
        ? 'short'
        : settings.maxWords > 0 && count > settings.maxWords
          ? 'long'
          : 'ok';
  return { words: count, length };
}

/**
 * Whether this text may be handed in, and what to say under the button.
 *
 * Ticked checklist items are not consulted (BEHAVIOR §7): they are the learner's own
 * tracking, and a task that refused a finished text because a box was unticked would be
 * grading the tracking instead of the writing.
 */
export function submitGate(task: StudentProjection, text: string): SubmitGate {
  const { words, length } = measure(task.settings, text);

  if (length === 'empty') return { canSubmit: false, block: 'empty', remaining: 0 };
  if (length === 'short') {
    return { canSubmit: false, block: 'short', remaining: task.settings.minWords - words };
  }
  if (length === 'long') return { canSubmit: false, block: 'long', remaining: 0 };
  return { canSubmit: true, block: null, remaining: 0 };
}

/**
 * The student's side of `writing_task` — everything from the mode badge to the readout
 * bar, in the order the handoff sets (README, "Screen 2").
 *
 * It renders the task and it owns the text; it decides nothing about the outcome. There
 * is no correct answer to compare against and no auto-check to run — every submission
 * reaches a person, so the only judgement made here is whether the text is long enough
 * to hand in, and that one is stated rather than hidden (`submitGate`).
 *
 * The graded card is not here. It belongs to the phase after a teacher has acted and is
 * drawn from the verdict they delivered, which this component never sees.
 */
export function WritingTaskBody({
  task,
  value,
  onValueChange,
  onGateChange,
  phase,
  attemptNo = 1,
  interactive = true,
  saveState = 'idle',
  imageUrl = null,
  mode = 'graded',
  accent,
}: WritingTaskBodyProps) {
  const t = useTranslations('ExerciseRunner');
  const s = task.settings;
  const isDraft = phase === 'draft';
  const editable = interactive && isDraft;
  const accentSoft = modeAccentSoft(mode);

  const [planOpen, setPlanOpen] = useState(true);
  const [pasteBlocked, setPasteBlocked] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(s.timer * 60);

  const { words, length } = useMemo(() => measure(s, value.text), [s, value.text]);
  const gate = useMemo(() => submitGate(task, value.text), [task, value.text]);
  const ticked = useMemo(() => new Set(value.ticked), [value.ticked]);

  useEffect(() => {
    onGateChange?.(gate);
  }, [gate, onGateChange]);

  // The clock restarts when the task's time changes and when a rewrite opens a new
  // draft — an author who shortens the time while a preview is open must see the new
  // one. Adjusted during render rather than in an effect: an effect would paint the old
  // countdown for a frame first, and a countdown that visibly jumps is the one thing a
  // countdown must not do.
  const timerKey = `${s.timer}:${attemptNo}`;
  const [lastTimerKey, setLastTimerKey] = useState(timerKey);
  if (timerKey !== lastTimerKey) {
    setLastTimerKey(timerKey);
    setSecondsLeft(s.timer * 60);
  }

  // Starts on the first keystroke and stops when the draft is left (BEHAVIOR §7). What
  // happens at zero is undecided in the handoff, so nothing happens: the pill floors at
  // 0:00 rather than this component inventing a rule that takes the work away.
  const hasText = value.text.trim() !== '';
  useEffect(() => {
    if (s.timer === 0 || !isDraft || !hasText) return;
    const id = setInterval(() => setSecondsLeft((left) => Math.max(0, left - 1)), 1000);
    return () => clearInterval(id);
  }, [s.timer, isDraft, hasText]);

  const pasteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (pasteTimer.current) clearTimeout(pasteTimer.current);
    },
    [],
  );

  const onPaste = useCallback(
    (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
      if (!s.blockPaste) return;
      // Cancelled, then explained. A paste that silently does nothing reads as a broken
      // page; focus stays in the field so a keyboard user is not thrown out of the text.
      event.preventDefault();
      setPasteBlocked(true);
      if (pasteTimer.current) clearTimeout(pasteTimer.current);
      pasteTimer.current = setTimeout(() => setPasteBlocked(false), PASTE_NOTICE_MS);
    },
    [s.blockPaste],
  );

  const appendPhrase = (phrase: string) => {
    if (!editable) return;
    const base = value.text === '' ? '' : value.text.replace(/\s*$/, ' ');
    onValueChange({ ...value, text: `${base}${phrase} ` });
  };

  const togglePoint = (id: string) => {
    if (!editable) return;
    const next = new Set(value.ticked);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onValueChange({ ...value, ticked: [...next] });
  };

  const meterMax = s.maxWords || s.minWords || 1;
  const meterWidth = Math.min(100, (words / meterMax) * 100);
  const countColor =
    length === 'ok'
      ? 'var(--ssz-feedback-ok-fg)'
      : length === 'long'
        ? 'var(--ssz-feedback-no-fg)'
        : 'var(--ssz-color-warning-700)';

  return (
    <>
      <div className="mb-2.5 flex items-center gap-2">
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-bold"
          style={{ background: accentSoft, color: 'var(--ssz-text-primary)' }}
        >
          {t(`writingTask.modes.${task.mode}`)}
          {attemptNo > 1 && ` · ${t('writingTask.attemptNo', { n: attemptNo })}`}
        </span>
      </div>

      <Instr>{task.instruction || t('writingTask.defaultInstruction')}</Instr>

      {task.mode === 'picture' && (
        <figure className="mb-4">
          {imageUrl ? (
            // An author's uploaded asset, served from media-service: a remote host with
            // no build-time dimensions, which is what `next/image` wants.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageUrl}
              alt={task.image?.alt || t('writingTask.imageAlt')}
              style={{ width: '100%', borderRadius: 12, display: 'block' }}
            />
          ) : (
            <div
              className="flex flex-col items-center justify-center gap-2 py-8 text-[12.5px]"
              style={{
                borderRadius: 12,
                border: '1.5px dashed var(--ssz-border-default)',
                color: 'var(--ssz-text-muted)',
              }}
            >
              <ImageIcon size={22} aria-hidden="true" />
              {t('writingTask.imageMissing')}
            </div>
          )}
          {task.image?.caption?.trim() && (
            <figcaption className="mt-2 text-[12.5px]" style={{ color: 'var(--ssz-text-muted)' }}>
              {task.image.caption}
            </figcaption>
          )}
        </figure>
      )}

      {task.mode === 'retell' && task.source?.trim() && (
        <div
          className="mb-4 whitespace-pre-wrap px-3.5 py-3"
          style={{
            borderLeft: `3px solid ${accent}`,
            background: 'var(--ssz-bg-surface)',
            borderRadius: '0 10px 10px 0',
            fontFamily: READING,
            fontSize: 15,
            lineHeight: 1.7,
            color: 'var(--ssz-text-primary)',
          }}
        >
          {task.source}
        </div>
      )}

      <h3
        className="mb-2 leading-[1.45]"
        style={{
          fontFamily: READING,
          fontSize: 19,
          fontWeight: 600,
          color: 'var(--ssz-text-primary)',
        }}
      >
        {task.prompt}
      </h3>

      {task.mode === 'letter' && task.letter?.recipient?.trim() && (
        <p className="mb-4 text-[12.5px]" style={{ color: 'var(--ssz-text-muted)' }}>
          {t('writingTask.letterLine', {
            recipient: task.letter.recipient,
            register: t(`writingTask.register.${task.letter.register}`),
          })}
        </p>
      )}

      {s.showPlan && task.points.length > 0 && (
        <div
          className="mb-4 overflow-hidden"
          style={{ borderRadius: 12, border: '1.5px solid var(--ssz-border-default)' }}
        >
          <button
            type="button"
            onClick={() => setPlanOpen((open) => !open)}
            aria-expanded={planOpen}
            className="flex w-full items-center gap-2 px-3.5 py-2.5 text-[12.5px] font-bold"
            style={{ background: 'var(--ssz-bg-surface)', color: 'var(--ssz-text-primary)' }}
          >
            <CheckSquare size={13} aria-hidden="true" />
            {t('writingTask.checklistTitle')}
            <span className="ml-auto tabular-nums" style={{ color: 'var(--ssz-text-muted)' }}>
              {value.ticked.length}/{task.points.length}
            </span>
            {planOpen ? (
              <ChevronUp size={13} aria-hidden="true" />
            ) : (
              <ChevronDown size={13} aria-hidden="true" />
            )}
          </button>

          {planOpen && (
            <ul className="flex flex-col">
              {task.points.map((point) => {
                const on = ticked.has(point.id);
                return (
                  <li key={point.id}>
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={on}
                      disabled={!editable}
                      onClick={() => togglePoint(point.id)}
                      className="flex w-full items-start gap-2.5 px-3.5 py-2.5 text-left"
                      style={{
                        borderTop: '1px solid var(--ssz-border-default)',
                        cursor: editable ? 'pointer' : 'default',
                      }}
                    >
                      <span
                        className="mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center"
                        style={{
                          borderRadius: 5,
                          border: `1.5px solid ${on ? accent : 'var(--ssz-border-default)'}`,
                          background: on ? accent : 'transparent',
                          color: 'var(--ssz-text-on-brand)',
                        }}
                      >
                        {on && <Check size={11} aria-hidden="true" />}
                      </span>
                      <span
                        className="text-[14px]"
                        style={{ fontFamily: READING, color: 'var(--ssz-text-primary)' }}
                      >
                        {point.text}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {/*
        The rubric as a writing guide, not as an explanation of a mark — this block is
        why the projection takes the answer key at all (plan 50 §5). It renders only
        when the author chose `showRubric: 'always'`, and only from what the server sent:
        a projection built from `content` alone carries no `rubric`, and this silently
        disappears. That failure mode is the reason it is stated here.
      */}
      {task.rubric && task.rubric.length > 0 && (
        <div
          className="mb-4 px-3.5 py-3"
          style={{
            borderRadius: 12,
            border: '1.5px solid var(--ssz-border-default)',
            background: 'var(--ssz-bg-surface)',
          }}
        >
          <div
            className="mb-2 flex items-center gap-2 text-[12.5px] font-bold"
            style={{ color: 'var(--ssz-text-primary)' }}
          >
            <ClipboardCheck size={13} aria-hidden="true" />
            {t('writingTask.rubricTitle')}
            <span className="ml-auto font-semibold" style={{ color: 'var(--ssz-text-muted)' }}>
              {t('writingTask.passLine', { pass: s.passScore, max: task.rubricMax })}
            </span>
          </div>
          <ul className="flex flex-col gap-2">
            {task.rubric.map((criterion) => (
              <li key={criterion.id}>
                <p
                  className="text-[13px] font-semibold"
                  style={{ color: 'var(--ssz-text-primary)' }}
                >
                  {criterion.name}
                  {criterion.weight === 2 && (
                    <span className="ml-1.5 font-bold" style={{ color: 'var(--ssz-text-muted)' }}>
                      ×2
                    </span>
                  )}
                </p>
                {criterion.desc.trim() !== '' && (
                  <p className="text-[12.5px]" style={{ color: 'var(--ssz-text-muted)' }}>
                    {criterion.desc}
                  </p>
                )}
                {criterion.levels[3].trim() !== '' && (
                  <p
                    className="text-[12.5px]"
                    style={{ fontFamily: READING, color: 'var(--ssz-text-secondary)' }}
                  >
                    {t('writingTask.topLevel', { descriptor: criterion.levels[3] })}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {s.showPhrases && task.phrases.length > 0 && (
        <div className="mb-4">
          <div
            className="mb-2 flex items-center gap-2 text-[12.5px] font-bold"
            style={{ color: 'var(--ssz-text-primary)' }}
          >
            <Wand2 size={13} aria-hidden="true" />
            {t('writingTask.phrasesTitle')}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {task.phrases.map((phrase, i) => (
              <button
                key={`${phrase}-${i}`}
                type="button"
                disabled={!editable}
                onClick={() => appendPhrase(phrase)}
                className="px-2.5 py-1 text-[12.5px]"
                style={{
                  borderRadius: 999,
                  border: '1.5px solid var(--ssz-border-default)',
                  background: 'var(--ssz-bg-surface)',
                  color: 'var(--ssz-text-primary)',
                  fontFamily: READING,
                  cursor: editable ? 'pointer' : 'default',
                }}
              >
                {phrase}
              </button>
            ))}
          </div>
        </div>
      )}

      {isDraft ? (
        <>
          <textarea
            value={value.text}
            readOnly={!editable}
            aria-label={t('writingTask.inputLabel')}
            placeholder={t('writingTask.placeholder')}
            onChange={(event) => onValueChange({ ...value, text: event.target.value })}
            onPaste={onPaste}
            rows={10}
            style={{
              width: '100%',
              minHeight: 220,
              fontFamily: READING,
              fontSize: 16,
              lineHeight: 1.75,
              color: 'var(--ssz-text-primary)',
              border: '2px solid var(--ssz-border-default)',
              borderRadius: 12,
              background: 'var(--ssz-bg-surface)',
              padding: '14px 16px',
              outline: 'none',
              resize: 'vertical',
            }}
          />

          <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px]">
            {s.showWordCount && (
              <span className="flex items-center gap-2" style={{ color: countColor }}>
                <span
                  aria-hidden="true"
                  style={{
                    display: 'inline-block',
                    width: 54,
                    height: 4,
                    borderRadius: 999,
                    background: 'var(--ssz-border-default)',
                    overflow: 'hidden',
                  }}
                >
                  <span
                    style={{
                      display: 'block',
                      width: `${meterWidth}%`,
                      height: '100%',
                      background: countColor,
                    }}
                  />
                </span>
                <span className="tabular-nums">
                  {s.maxWords > 0
                    ? t('writingTask.wordRange', { count: words, min: s.minWords, max: s.maxWords })
                    : t('writingTask.wordRangeOpen', { count: words, min: s.minWords })}
                </span>
              </span>
            )}

            {s.timer > 0 && (
              <span
                className="flex items-center gap-1 tabular-nums"
                style={{
                  color:
                    secondsLeft < TIMER_WARN_S
                      ? 'var(--ssz-color-warning-700)'
                      : 'var(--ssz-text-muted)',
                }}
              >
                <Clock size={11} aria-hidden="true" />
                {formatClock(secondsLeft)}
              </span>
            )}

            {s.blockPaste && (
              <span className="flex items-center gap-1" style={{ color: 'var(--ssz-text-muted)' }}>
                <Ban size={11} aria-hidden="true" />
                {t('writingTask.pasteOff')}
              </span>
            )}

            {s.autosave && saveState !== 'idle' && (
              <span
                className="ml-auto"
                style={{ color: 'var(--ssz-text-muted)' }}
                aria-live="polite"
              >
                {saveState === 'saving' ? t('writingTask.saving') : t('writingTask.saved')}
              </span>
            )}
          </div>

          {/*
            The countdown is announced at the two thresholds only. A per-second live
            region would read the clock aloud over the writing it is timing.
          */}
          <p className="sr-only" aria-live="polite">
            {s.timer > 0 && hasText && (secondsLeft === TIMER_WARN_S || secondsLeft === 60)
              ? t('writingTask.timeLeft', { minutes: Math.round(secondsLeft / 60) })
              : ''}
          </p>

          {pasteBlocked && (
            <p
              role="status"
              className="mt-2 flex items-center gap-1.5 text-[12.5px]"
              style={{ color: 'var(--ssz-color-warning-700)' }}
            >
              <TriangleAlert size={13} aria-hidden="true" />
              {t('writingTask.pasteBlocked')}
            </p>
          )}
        </>
      ) : (
        <blockquote
          className="whitespace-pre-wrap px-3.5 py-3"
          style={{
            borderLeft: `3px solid ${accent}`,
            background: 'var(--ssz-bg-surface)',
            borderRadius: '0 10px 10px 0',
            fontFamily: READING,
            fontSize: 15,
            lineHeight: 1.75,
            color: 'var(--ssz-text-primary)',
          }}
        >
          {value.text}
        </blockquote>
      )}
    </>
  );
}

/** `615` → `10:15`. Floors at zero — the handoff leaves what happens there undecided. */
function formatClock(seconds: number): string {
  const safe = Math.max(0, seconds);
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, '0')}`;
}

'use client';

import { useId, useMemo, type CSSProperties, type ReactNode } from 'react';
import {
  ArrowRight,
  Check,
  CircleAlert,
  Eraser,
  Highlighter,
  Info,
  RotateCcw,
  Volume2,
  X,
} from 'lucide-react';
import { useTranslations } from 'next-intl';

import { useContainerWidth } from '@/hooks';
import {
  AudioLockNote,
  AudioTranscript,
  ExerciseAudioPlayer,
  type ExerciseAudioEngine,
} from '@/features/student/exercises/audio';
import { tokenize, type StudentProjection } from '@/lib/shared-kernel/highlight-in-text';
import type { HighlightInTextSubmitDetails } from '@/features/student/exercises/types/attempts';

import { passageCells, type StudentMarks } from './highlight-in-text-marks';
import { MarkableText } from './markable-text';

export type HighlightInTextLayout = 'phone' | 'desktop';

/**
 * Where the side column earns its place: 260px for it, a gap, and enough left for a reading
 * line (`ht.css`: the desktop body collapses to one column at 820px of window — here it is
 * the body's own width, because the builder preview is a phone frame on a desktop screen).
 */
const SIDE_COLUMN_AT = 680;
const TAP_MIN = 44;
/** Verdict blocks settle in 3px from above (BEHAVIOR §9); reduced motion is global. */
const SETTLE = 'fade-down var(--ssz-duration-slow) var(--ssz-ease-out)';

const TONE = {
  ok: { background: 'var(--ssz-color-success-50)', color: 'var(--ssz-color-success-700)' },
  bad: { background: 'var(--ssz-color-error-50)', color: 'var(--ssz-color-error-700)' },
  reveal: { background: 'var(--ssz-color-primary-50)', color: 'var(--ssz-color-primary-700)' },
} as const;

const FOCUS =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ssz-border-focus)';

export interface HighlightInTextBodyProps {
  /** The passage and its questions as the server dealt them — no spans, no key. */
  projection: StudentProjection;
  /** The exercise's title — the desktop eyebrow. The builder preview has one; the reader does not. */
  title?: string;
  /** Replaces the author's instruction line, which the reader translates per learner. */
  instruction?: string;
  /** The question on screen, an index into `projection.questions`. */
  questionIndex: number;
  /** Per question of the projection: closed — passed, revealed or out of checks (AC-S12). */
  completed: readonly boolean[];
  /** The student's marks on the question on screen. */
  marks: StudentMarks;
  onMark: (origin: number, end: number) => void;
  onExtend: (i: number, delta: 1 | -1) => void;
  onClear: () => void;
  /** The last check or reveal of this question; `null` while marking. */
  verdict: HighlightInTextSubmitDetails | null;
  /** The check this question is on, 1-based — one past the last after a retry. */
  attempt: number;
  sending?: boolean;
  error?: string | null;
  /** False in a static preview: everything renders, nothing accepts input. */
  interactive?: boolean;
  /** Forces a layout — the builder preview's phone/desktop switch, and tests (jsdom measures 0). */
  layout?: HighlightInTextLayout;
  onCheck: () => void;
  onRetry: () => void;
  onReveal: () => void;
  onNext: () => void;
  accent: string;
  /** The listening layer, mounted once for the exercise by whoever owns the document (plan 56). */
  audio?: ExerciseAudioEngine;
  /** What the clip said, once the engine hands it over with the closing verdict. */
  audioTranscript?: { transcript: string; translation: string } | null;
}

/**
 * `highlight_in_text`, as the learner plays it: a passage, a question, and the words to
 * mark in it — one question at a time (BEHAVIOR §6).
 *
 * One component, two layouts, switched on its **own** width (`useContainerWidth`) unless a
 * `layout` is forced. Phone: the progress rail and the prompt on top, the passage, and the
 * counter and actions stuck to the bottom. Desktop: the passage in the main column and the
 * prompt, counter, verdict and actions in a sticky side column 260px wide.
 *
 * Controlled, and it owns nothing about the outcome. Whether a mark is right, whether the
 * question passed and whether it is closed are the server's — nothing here knows the key, so
 * there is no branch that could colour a mark before a check. What a check returns is drawn
 * as it came.
 */
export function HighlightInTextBody({
  projection,
  title,
  instruction,
  questionIndex,
  completed,
  marks,
  onMark,
  onExtend,
  onClear,
  verdict,
  attempt,
  sending = false,
  error = null,
  interactive = true,
  layout,
  onCheck,
  onRetry,
  onReveal,
  onNext,
  accent,
  audio,
  audioTranscript = null,
}: HighlightInTextBodyProps) {
  const t = useTranslations('ExerciseRunner.highlightInText');
  const tAudio = useTranslations('ExerciseRunner.audio');
  const [root, width] = useContainerWidth();
  const promptId = useId();

  const { text, questions, settings } = projection;
  const tokens = useMemo(() => tokenize(text), [text]);

  const { cells, numbers } = useMemo(
    () => passageCells(marks, verdict, tokens),
    [marks, verdict, tokens],
  );

  if (questions.length === 0) {
    return (
      <div
        ref={root}
        className="rounded-2xl px-6 py-10 text-center"
        style={{ border: '1.5px dashed var(--ssz-border-default)' }}
      >
        <Highlighter
          size={20}
          aria-hidden="true"
          className="mx-auto mb-2 text-(--ssz-text-muted)"
        />
        <p className="m-0 text-sm font-semibold text-(--ssz-text-primary)">{t('empty.title')}</p>
        <p className="m-0 mt-1 text-xs text-(--ssz-text-muted)">{t('empty.body')}</p>
      </div>
    );
  }

  const index = Math.min(Math.max(questionIndex, 0), questions.length - 1);
  const question = questions[index]!;
  const desktop = (layout ?? (width >= SIDE_COLUMN_AT ? 'desktop' : 'phone')) === 'desktop';
  const last = index === questions.length - 1;

  const audioOn = audio !== undefined && audio.audio.enabled;
  // A `gate` layout locks the passage until the clip has been heard through once.
  const audioLocked = audioOn && audio.gated;

  const revealed = verdict !== null && verdict.revealed && verdict.key !== undefined;
  const checked = verdict !== null && !revealed;
  const closed = verdict?.closed === true;
  const passed = checked && verdict.passed;
  const marking = verdict === null;
  const live = interactive && marking && !sending && !audioLocked && !completed[index];

  // ── head: the rail and the prompt ────────────────────────────────────────
  const head = (
    <>
      {questions.length > 1 && (
        <div className="flex items-center gap-1.5">
          <span className="sr-only">
            {t('rail', {
              n: index + 1,
              total: questions.length,
              done: completed.filter(Boolean).length,
            })}
          </span>
          {questions.map((q, i) => (
            <i
              key={q.id}
              aria-hidden="true"
              data-s={completed[i] ? 'done' : i === index ? 'now' : undefined}
              className="block h-1 flex-1 rounded-full"
              style={{
                background: completed[i]
                  ? 'var(--ssz-color-success-500)'
                  : i === index
                    ? 'var(--ssz-color-primary-500)'
                    : 'var(--ssz-bg-muted)',
              }}
            />
          ))}
          <span
            aria-hidden="true"
            className="text-[11px] text-(--ssz-text-muted)"
            style={{ fontFamily: 'var(--ssz-font-mono)' }}
          >
            {index + 1}/{questions.length}
          </span>
        </div>
      )}
      <div
        className="flex items-start gap-2.5 rounded-(--ssz-radius-md) px-3 py-[11px]"
        style={{
          background: 'var(--ssz-color-primary-50)',
          color: 'var(--ssz-color-primary-800)',
        }}
      >
        {audioOn ? (
          <Volume2 size={16} aria-hidden="true" className="mt-0.5 shrink-0" />
        ) : (
          <Highlighter size={16} aria-hidden="true" className="mt-0.5 shrink-0" />
        )}
        <div>
          <strong id={promptId} className="block text-sm font-semibold leading-snug">
            {question.prompt}
          </strong>
          <span
            className="mt-[3px] block text-xs opacity-85"
            style={{ color: 'var(--ssz-color-primary-700)' }}
          >
            {question.unit === 'word' ? t('tapWords') : t('tapOrDrag')}
            {question.count !== null && ` ${t('count', { n: question.count })}`}
          </span>
        </div>
      </div>
    </>
  );

  const instructionText =
    instruction !== undefined && instruction !== '' ? instruction : projection.instruction;
  const instructionLine =
    instructionText.trim() === '' ? null : (
      <p className="m-0 text-sm text-(--ssz-text-secondary)">{instructionText}</p>
    );

  const passage = (
    <div className="rounded-(--ssz-radius-md) px-1 py-3">
      <MarkableText
        text={text}
        unit={question.unit}
        live={live}
        cellOf={(i) => cells.get(i) ?? null}
        numbers={(i) => numbers.get(i) ?? null}
        onRange={onMark}
        onExtend={onExtend}
        labelledBy={promptId}
      />
    </div>
  );

  const audioBlock = audioOn ? (
    <div>
      <ExerciseAudioPlayer eng={audio} interactive={interactive} />
      {audioLocked && <AudioLockNote itemNoun={tAudio('itemNoun.items')} />}
    </div>
  ) : null;

  // ── verdict ──────────────────────────────────────────────────────────────
  const deducted =
    checked &&
    verdict.fp > 0 &&
    verdict.total > 0 &&
    verdict.pct !== Math.round((verdict.exact * 100) / verdict.total);

  const verdictBlock = checked ? (
    <div className="flex flex-col gap-[7px]">
      {/* Counts first, and alone: hints are ordinary text below (AC-X8). */}
      <p role="status" className="sr-only">
        {t('announce', { correct: verdict.exact, total: verdict.total, fp: verdict.fp })}
      </p>
      <Note
        tone={passed ? 'ok' : 'bad'}
        icon={passed ? <Check size={14} /> : <CircleAlert size={14} />}
      >
        <b className="font-semibold">
          {t('verdict', { correct: verdict.exact, total: verdict.total, fp: verdict.fp })}
        </b>{' '}
        {deducted ? t('scoreAfter', { pct: verdict.pct }) : t('score', { pct: verdict.pct })}
      </Note>
      {verdict.near > 0 && (
        <Note tone="reveal" icon={<Info size={14} />}>
          {t('near', { n: verdict.near })}
        </Note>
      )}
      {verdict.missHint !== undefined && (
        <Note tone="reveal" icon={<Info size={14} />}>
          {verdict.missHint}
        </Note>
      )}
      {verdict.fpHint !== undefined && (
        <Note tone="bad" icon={<X size={14} />}>
          {verdict.fpHint}
        </Note>
      )}
    </div>
  ) : null;

  // A legend with the verdict, never before it (BEHAVIOR §6).
  const legend =
    checked || revealed ? (
      <div className="flex flex-wrap gap-3 text-[11px] text-(--ssz-text-muted)">
        {revealed ? (
          <Swatch style={{ background: 'var(--ssz-color-primary-100)' }}>{t('legend.key')}</Swatch>
        ) : (
          <>
            <Swatch style={{ background: 'var(--ssz-color-success-100)' }}>
              {t('legend.right')}
            </Swatch>
            <Swatch style={{ background: 'var(--ssz-color-error-50)' }}>{t('legend.extra')}</Swatch>
            <Swatch style={{ boxShadow: 'inset 0 -2px 0 0 var(--ssz-color-primary-400)' }}>
              {t('legend.missed')}
            </Swatch>
          </>
        )}
      </div>
    ) : null;

  // ── counter and actions ──────────────────────────────────────────────────
  const counter = (
    <div className="flex items-center gap-2 text-xs text-(--ssz-text-muted)">
      <Highlighter size={13} aria-hidden="true" />
      <span>
        {t.rich(question.count !== null ? 'markedOf' : 'marked', {
          n: marks.length,
          total: question.count ?? 0,
          b: (chunks) => (
            <b
              className="text-(--ssz-text-secondary)"
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {chunks}
            </b>
          ),
        })}
      </span>
      {marks.length > 0 && marking && interactive && (
        <>
          <span className="flex-1" />
          <button
            type="button"
            onClick={onClear}
            disabled={sending}
            className={`inline-flex items-center gap-1.5 rounded-(--ssz-radius-sm) px-2 py-1 text-xs font-medium text-(--ssz-text-secondary) hover:bg-(--ssz-bg-muted) disabled:opacity-50 ${FOCUS}`}
          >
            <Eraser size={13} aria-hidden="true" />
            {t('clear')}
          </button>
        </>
      )}
    </div>
  );

  const primary = (
    label: ReactNode,
    onClick: () => void,
    disabled: boolean,
    icon?: ReactNode,
    iconRight?: ReactNode,
  ) => (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex w-full items-center justify-center gap-2 rounded-(--ssz-radius-sm) px-3 py-3 text-sm font-semibold text-white disabled:pointer-events-none disabled:opacity-50 ${FOCUS}`}
      style={{ background: accent, minHeight: TAP_MIN }}
    >
      {icon}
      {label}
      {iconRight}
    </button>
  );

  const attemptLine =
    settings.attempts === 0
      ? t('attempt', { n: attempt })
      : t('attemptOf', { n: attempt, max: settings.attempts });

  const actions = (
    <div className="flex flex-col gap-2">
      {marking &&
        primary(
          sending
            ? t('checking')
            : marks.length > 0
              ? t('checkCount', { n: marks.length })
              : t('check'),
          onCheck,
          !interactive || sending || audioLocked || marks.length === 0 || completed[index] === true,
        )}
      {checked &&
        !passed &&
        !closed &&
        primary(
          t('retry'),
          onRetry,
          !interactive || sending,
          <RotateCcw size={14} aria-hidden="true" />,
        )}
      {checked && !passed && settings.revealKey && (
        <button
          type="button"
          onClick={onReveal}
          disabled={!interactive || sending}
          className={`inline-flex w-full items-center justify-center rounded-(--ssz-radius-sm) px-3 py-2 text-xs font-medium text-(--ssz-text-secondary) hover:bg-(--ssz-bg-muted) disabled:pointer-events-none disabled:opacity-50 ${FOCUS}`}
          style={{ minHeight: TAP_MIN }}
        >
          {t('showKey')}
        </button>
      )}
      {/* Closed and not the last: on to the next. The last one ends here — the player owns
          what comes after the exercise (plan 67 §5, deviation 12). */}
      {closed &&
        !last &&
        primary(
          t('next'),
          onNext,
          !interactive || sending,
          undefined,
          <ArrowRight size={14} aria-hidden="true" />,
        )}
      {(verdict !== null || attempt > 1) && (
        <p className="m-0 flex items-center justify-center p-1.5 text-xs text-(--ssz-text-muted)">
          {attemptLine}
        </p>
      )}
      {revealed && (
        <div className="flex flex-col gap-1.5" style={{ animation: SETTLE }}>
          {verdict
            .key!.filter((span) => span.why !== undefined && span.why.trim() !== '')
            .map((span) => (
              <p key={span.n} className="m-0 text-xs text-(--ssz-text-muted)">
                <b className="font-semibold text-(--ssz-text-secondary)">
                  {span.n}. {text.slice(span.start, span.end)}
                </b>{' '}
                — {span.why}
              </p>
            ))}
        </div>
      )}
      {error !== null && (
        <p className="m-0 flex items-start gap-1.5 text-xs" style={{ color: TONE.bad.color }}>
          <CircleAlert size={13} aria-hidden="true" className="mt-0.5 shrink-0" />
          {error}
        </p>
      )}
    </div>
  );

  const transcript = audioOn ? (
    <AudioTranscript
      audio={audio.audio}
      revealed={audioTranscript !== null}
      delivered={audioTranscript}
    />
  ) : null;

  if (desktop) {
    return (
      <div
        ref={root}
        data-layout="desktop"
        className="grid items-start gap-6"
        style={{ gridTemplateColumns: 'minmax(0, 1fr) 260px' }}
      >
        <div className="flex min-w-0 flex-col gap-3">
          {title !== undefined && (
            <p className="m-0 text-[11px] font-bold uppercase tracking-[0.07em] text-(--ssz-text-muted)">
              {title.trim() === '' ? t('untitled') : title}
            </p>
          )}
          {instructionLine}
          {audioBlock}
          {passage}
          {legend}
          {transcript}
        </div>
        <div className="sticky top-0 flex flex-col gap-3">
          {head}
          {counter}
          {verdictBlock}
          {actions}
        </div>
      </div>
    );
  }

  return (
    <div ref={root} data-layout="phone" className="flex flex-col gap-3">
      {head}
      {instructionLine}
      {audioBlock}
      {passage}
      {legend}
      {verdictBlock}
      {transcript}
      <div
        className="sticky bottom-0 z-10 -mx-1 flex flex-col gap-2.5 border-t px-1 pb-2 pt-3"
        style={{ background: 'var(--ssz-bg-surface)', borderColor: 'var(--ssz-border-default)' }}
      >
        {counter}
        {actions}
      </div>
    </div>
  );
}

function Note({
  tone,
  icon,
  children,
}: {
  tone: keyof typeof TONE;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <div
      data-tone={tone}
      className="flex gap-2 rounded-(--ssz-radius-sm) px-3 py-2.5 text-sm leading-snug"
      style={{ ...TONE[tone], animation: SETTLE }}
    >
      <span aria-hidden="true" className="mt-0.5 shrink-0">
        {icon}
      </span>
      <div>{children}</div>
    </div>
  );
}

function Swatch({ style, children }: { style: CSSProperties; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-[5px]">
      <i aria-hidden="true" className="block size-3 rounded-[4px]" style={style} />
      {children}
    </span>
  );
}

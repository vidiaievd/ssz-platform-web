'use client';

import { useId, useState, type ReactNode } from 'react';
import { ArrowRight, Check, CircleAlert, Info, Mic, RotateCcw, Target } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { useContainerWidth } from '@/hooks';
import {
  AudioGateScreen,
  AudioLockNote,
  AudioSegmentButton,
  AudioTranscript,
  ExerciseAudioPlayer,
  type ExerciseAudioEngine,
} from '@/features/student/exercises/audio';
import {
  wordCount,
  type SegmentState,
  type StudentProjection,
  type VerdictOp,
  type WordCounts,
} from '@/lib/shared-kernel/dictation';
import type { DictationSubmitDetails } from '@/features/student/exercises/types/attempts';

import { deviationPhrase, DiffLegend, DiffLine, DiffScore, DiffTally } from './diff-line';

export type DictationLayout = 'phone' | 'desktop';

/**
 * Where the side column earns its place: 300px for it, a gap, and enough left for a field
 * (`dc.css`: the desktop body collapses to one column at 820px of window — here it is the
 * body's own width, because the builder preview is a phone frame on a desktop screen).
 */
const SIDE_COLUMN_AT = 720;
const TAP_MIN = 44;
/** The verdict settles in over one slow beat (BEHAVIOR §8); reduced motion is global. */
const SETTLE = 'fade-down var(--ssz-duration-slow) var(--ssz-ease-out)';

const TONE = {
  ok: { background: 'var(--ssz-feedback-ok-bg)', color: 'var(--ssz-feedback-ok-fg)' },
  bad: { background: 'var(--ssz-feedback-no-bg)', color: 'var(--ssz-feedback-no-fg)' },
  reveal: { background: 'var(--ssz-feedback-key-bg)', color: 'var(--ssz-feedback-key-fg)' },
} as const;

const FOCUS =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ssz-border-focus)';

const CAPS = 'text-[11px] font-bold uppercase tracking-(--ssz-tracking-widest)';

/** What the corrected block shows: a check, as it came. */
interface Corrected {
  ops: readonly VerdictOp[];
  words: WordCounts;
  pct: number;
  passed: boolean;
}

export interface DictationBodyProps {
  /** The sentences as the server dealt them — ids only, no text, no key. */
  projection: StudentProjection;
  /** The exercise's title — the desktop eyebrow. The builder preview has one; the reader does not. */
  title?: string;
  /** Replaces the author's instruction line, which the reader translates per learner. */
  instruction?: string;
  /** The sentence on screen, an index into `projection.segments`. */
  segmentIndex: number;
  /** The server's word on every sentence — the rail, the side list and the summary. */
  states: readonly SegmentState[];
  /** What is in the field. */
  text: string;
  onText: (text: string) => void;
  /** The last check or reveal of this sentence; `null` while writing. */
  verdict: DictationSubmitDetails | null;
  /** The check this sentence is on, 1-based — one past the last after a retry. */
  attempt: number;
  /** The summary instead of a sentence (AC-R10). */
  done?: boolean;
  /** The attempt's score and pass, from the server — the summary's head. */
  result?: { pct: number; passed: boolean } | null;
  /** «Sjekk» rests for a moment after a check — the server would refuse it (Q4-A). */
  cooling?: boolean;
  sending?: boolean;
  error?: string | null;
  /** False in a static preview: everything renders, nothing accepts input. */
  interactive?: boolean;
  /** Forces a layout — the builder preview's phone/desktop switch, and tests (jsdom measures 0). */
  layout?: DictationLayout;
  onCheck: () => void;
  onRetry: () => void;
  onReveal: () => void;
  onNext: () => void;
  onFinish: () => void;
  accent: string;
  /** The listening layer, mounted once for the exercise by whoever owns the document (plan 56). */
  audio?: ExerciseAudioEngine;
}

/**
 * `dictation`, as the learner plays it: a recording, and the sentences said in it written
 * down one at a time (BEHAVIOR §6).
 *
 * One component, two layouts, switched on its **own** width (`useContainerWidth`) unless a
 * `layout` is forced. Phone: the rail, the instruction, the player, the field and the
 * verdict, with the actions stuck to the bottom. Desktop: the field and the verdict in the
 * main column; the player, the list of sentences and the actions in a sticky side column.
 *
 * Controlled, and it owns nothing about the outcome. Nothing here knows the sentence: the
 * corrected line, the counts, the pass, the score and whether the sentence is closed are the
 * server's, and are drawn as they came (plan 68 §3.5, deviation 15).
 */
export function DictationBody({
  projection,
  title,
  instruction,
  segmentIndex,
  states,
  text,
  onText,
  verdict,
  attempt,
  done = false,
  result = null,
  cooling = false,
  sending = false,
  error = null,
  interactive = true,
  layout,
  onCheck,
  onRetry,
  onReveal,
  onNext,
  onFinish,
  accent,
  audio,
}: DictationBodyProps) {
  const t = useTranslations('ExerciseRunner.dictation');
  const [root, width] = useContainerWidth();
  const fieldId = useId();
  /** Past the listen-first screen of a `gate` layout. */
  const [entered, setEntered] = useState(false);

  const { segments, settings, mode } = projection;
  const stateOf = (id: string | undefined) => states.find((s) => s.segmentId === id);

  if (segments.length === 0) {
    return (
      <div
        ref={root}
        className="rounded-2xl px-6 py-10 text-center"
        style={{ border: '1.5px dashed var(--ssz-border-default)' }}
      >
        <Mic size={20} aria-hidden="true" className="mx-auto mb-2 text-(--ssz-text-muted)" />
        <p className="m-0 text-sm font-semibold text-(--ssz-text-primary)">{t('empty.title')}</p>
        <p className="m-0 mt-1 text-xs text-(--ssz-text-muted)">{t('empty.body')}</p>
      </div>
    );
  }

  const desktop = (layout ?? (width >= SIDE_COLUMN_AT ? 'desktop' : 'phone')) === 'desktop';
  const audioOn = audio !== undefined && audio.audio.enabled;
  const player = audioOn ? <ExerciseAudioPlayer eng={audio} interactive={interactive} /> : null;

  // ── the summary ──────────────────────────────────────────────────────────
  if (done) {
    const right = segments.filter((s) => stateOf(s.id)?.firstPassed === true).length;
    const summary = (
      <div className="flex flex-col gap-(--ssz-space-3)">
        <div
          className="flex items-center gap-(--ssz-space-4) rounded-(--ssz-radius-md) p-(--ssz-space-4)"
          style={{ background: 'var(--ssz-bg-subtle)' }}
        >
          {result !== null && <DiffScore pct={result.pct} ok={result.passed} size="xl" />}
          <div>
            <strong className="text-base text-(--ssz-text-primary)">
              {t('summaryCount', { n: right, total: segments.length })}
            </strong>
            <p className="m-0 text-xs text-(--ssz-text-muted)">{t('summarySub')}</p>
          </div>
        </div>
        <ol className="m-0 flex list-none flex-col p-0">
          {segments.map((s, k) => {
            const st = stateOf(s.id);
            // The reason the last check came back with, kept on the sentence's state so a
            // reload still has it; a revealed sentence has the one its reveal showed.
            const reason = st?.passed === true ? '' : (st?.last?.why ?? st?.key?.why ?? '');
            return (
              <li
                key={s.id}
                data-segment={s.id}
                className="grid items-start gap-2.5 border-t py-2.5"
                style={{
                  gridTemplateColumns: '22px minmax(0, 1fr) 46px',
                  borderColor: 'var(--ssz-border-default)',
                }}
              >
                <Num n={k + 1} />
                <div className="min-w-0">
                  {st?.last != null ? (
                    <DiffLine ops={st.last.ops} size="sm" />
                  ) : st?.key != null ? (
                    <KeyText text={st.key.text} />
                  ) : (
                    <p className="m-0 text-sm text-(--ssz-text-muted)">—</p>
                  )}
                  {reason.trim() !== '' && (
                    <p className="m-0 mt-1 text-xs text-(--ssz-text-muted)">{reason}</p>
                  )}
                </div>
                <span className="block text-right">
                  {/* The record: the first check, never a retry (AC-R8). */}
                  <DiffScore
                    pct={Math.round((st?.firstScore ?? 0) * 100)}
                    ok={st?.firstPassed === true}
                    size="sm"
                  />
                </span>
              </li>
            );
          })}
        </ol>
        <DiffLegend />
      </div>
    );

    if (desktop) {
      return (
        <div
          ref={root}
          data-layout="desktop"
          className="grid items-start gap-6"
          style={{ gridTemplateColumns: 'minmax(0, 1fr) 300px' }}
        >
          <div className="min-w-0">{summary}</div>
          <div className="sticky top-0 flex flex-col gap-3">{player}</div>
        </div>
      );
    }
    return (
      <div ref={root} data-layout="phone">
        {summary}
      </div>
    );
  }

  // `layout: 'gate'` fills the body with the listen-first screen until it is left.
  if (audioOn && audio.audio.settings.layout === 'gate' && !entered) {
    return (
      <div ref={root}>
        <AudioGateScreen eng={audio} interactive={interactive} onStart={() => setEntered(true)} />
      </div>
    );
  }

  const index = Math.min(Math.max(segmentIndex, 0), segments.length - 1);
  const segment = segments[index]!;
  const here = stateOf(segment.id);
  const whole = mode === 'whole';

  // A listen-first gate locks the field until the clip has been heard through (AC-R5).
  const gated = audioOn && audio.gated;
  const revealed = verdict?.revealed === true;
  const checked = verdict !== null && !revealed;
  const closed = verdict?.closed === true || here?.closed === true;
  const passed = checked && verdict.passed;
  const writing = verdict === null && !closed;
  const fieldLive = interactive && writing && !sending && !gated;
  const key = verdict?.key ?? here?.key ?? null;

  // After a reveal the line still shows: it is the last check, kept on the sentence's state.
  const corrected: Corrected | null = checked
    ? verdict
    : revealed && here?.last != null
      ? { ...here.last, passed: false }
      : null;

  const hasNext = segments.some((s, i) => i > index && stateOf(s.id)?.closed !== true);
  const timecode = !whole && audioOn ? (audio.segments[segment.id] ?? null) : null;
  const typed = wordCount(text);

  // ── head: the rail and the instruction ───────────────────────────────────
  const rail =
    segments.length > 1 ? (
      <div className="flex items-center gap-1.5">
        <span className="sr-only">{t('rail', { n: index + 1, total: segments.length })}</span>
        {segments.map((s, k) => {
          const st = stateOf(s.id);
          // Three states, as the prototype has them (plan 68 §4.2, 11): spelled right,
          // checked and not (yet) right, the one being written.
          const state =
            st?.passed === true
              ? 'done'
              : (st?.checks ?? 0) > 0 || st?.revealed === true
                ? 'part'
                : k === index
                  ? 'now'
                  : undefined;
          return (
            <i
              key={s.id}
              aria-hidden="true"
              data-s={state}
              className="block h-1 flex-1 rounded-full"
              style={{
                background:
                  state === 'done'
                    ? 'var(--ssz-color-success-500)'
                    : state === 'part'
                      ? 'var(--ssz-color-warning-500)'
                      : state === 'now'
                        ? 'var(--ssz-color-primary-500)'
                        : 'var(--ssz-bg-muted)',
              }}
            />
          );
        })}
        <span
          aria-hidden="true"
          className="text-[11px] text-(--ssz-text-muted)"
          style={{ fontFamily: 'var(--ssz-font-mono)' }}
        >
          {index + 1}/{segments.length}
        </span>
      </div>
    ) : null;

  const instructionText =
    instruction !== undefined && instruction !== '' ? instruction : projection.instruction;
  const instructionLine =
    instructionText.trim() === '' ? null : (
      <p className="m-0 text-sm text-(--ssz-text-secondary)">{instructionText}</p>
    );

  // ── the field ────────────────────────────────────────────────────────────
  const field = (
    <div
      data-state={corrected === null ? undefined : corrected.passed ? 'ok' : 'bad'}
      className="flex flex-col gap-[9px] rounded-(--ssz-radius-md) border p-(--ssz-space-3)"
      style={{
        background: 'var(--ssz-bg-surface)',
        borderColor:
          corrected === null
            ? 'var(--ssz-border-default)'
            : corrected.passed
              ? 'var(--ssz-color-success-500)'
              : 'var(--ssz-color-error-300)',
      }}
    >
      <div
        className={`flex flex-wrap items-center gap-(--ssz-space-2) text-(--ssz-text-muted) ${CAPS}`}
      >
        <label htmlFor={fieldId}>
          {whole ? t('fieldWhole') : t('fieldSentence', { n: index + 1 })}
        </label>
        {timecode !== null && (
          // Free, always: a fragment spends no listen (AC-R2).
          <span className="normal-case tracking-normal [&>button]:mt-0">
            <AudioSegmentButton eng={audio!} segment={timecode} disabled={!interactive || gated} />
          </span>
        )}
        <span className="flex-1" />
        <span
          className="text-[11px] font-normal normal-case tracking-normal text-(--ssz-text-muted)"
          style={{ fontFamily: 'var(--ssz-font-mono)' }}
        >
          {settings.showWordCount && segment.wordCount !== undefined
            ? t.rich('wordsOf', {
                n: typed,
                total: segment.wordCount,
                b: (chunks) => <b className="text-(--ssz-text-secondary)">{chunks}</b>,
              })
            : t('words', { n: typed })}
        </span>
      </div>
      <textarea
        id={fieldId}
        rows={whole ? 8 : 3}
        value={text}
        onChange={(e) => onText(e.target.value)}
        disabled={!fieldLive}
        placeholder={gated ? t('placeholderGated') : t('placeholder')}
        // Load-bearing, not hygiene: a keyboard that fixes `sjøkken` to `kjøkken` destroys
        // the exercise (BEHAVIOR §6, AC-R11).
        autoCorrect="off"
        autoCapitalize="off"
        autoComplete="off"
        spellCheck={false}
        className="w-full resize-y rounded-(--ssz-radius-sm) border-none p-3 text-(--ssz-text-primary) focus:shadow-(--ssz-focus-ring) focus:outline-none disabled:bg-(--ssz-bg-subtle) disabled:text-(--ssz-text-secondary)"
        style={{
          background: fieldLive ? 'var(--ssz-bg-base)' : undefined,
          fontFamily: 'var(--ssz-font-reading)',
          fontSize: 'var(--ssz-text-lg)',
          lineHeight: 'var(--ssz-leading-relaxed)',
        }}
      />
      {corrected !== null && (
        <div
          data-block="corrected"
          className="flex flex-col gap-2 rounded-(--ssz-radius-sm) px-3 py-2.5"
          style={{ background: 'var(--ssz-bg-base)', animation: SETTLE }}
        >
          <BlockLabel>{t('corrected')}</BlockLabel>
          <DiffLine ops={corrected.ops} />
          <div className="flex items-center gap-2">
            <DiffTally words={corrected.words} />
            <span className="flex-1" />
            <DiffScore pct={corrected.pct} ok={corrected.passed} />
          </div>
        </div>
      )}
      {key !== null && (
        <div
          data-block="key"
          className="flex flex-col gap-2 rounded-(--ssz-radius-sm) px-3 py-2.5"
          style={{ background: 'var(--ssz-feedback-key-bg)', animation: SETTLE }}
        >
          <BlockLabel>{t('key')}</BlockLabel>
          <KeyText text={key.text} />
        </div>
      )}
    </div>
  );

  // ── the verdict ──────────────────────────────────────────────────────────
  // A typo note only where typos were counted; «half credit» only where the server says this
  // check gave it — the rule itself is never sent ahead of a check (deviation 15).
  const halfCredit = checked && verdict.nearCredit;
  const headline = checked
    ? passed
      ? t('passed')
      : t('verdict', {
          correct: verdict.words.exact,
          total: verdict.words.total,
          near: verdict.words.near,
          half: halfCredit ? 'true' : 'false',
        })
    : null;

  const focusLines = checked
    ? verdict.focus.map((f) => ({ id: f.focusId, word: f.word, why: f.why }))
    : revealed && key !== null
      ? key.focus
          .filter((f) => f.why.trim() !== '')
          .map((f) => ({ id: f.focusId, word: f.word, why: f.why }))
      : [];
  const reason = checked ? (verdict.why ?? '') : revealed && key !== null ? key.why : '';

  // Announced once, the count first and then «wrote X, correct Y» per deviation (AC-X11).
  const announcement = checked
    ? [headline, ...verdict.ops.map((op) => deviationPhrase(op, t)).filter((p) => p !== null)]
        .filter(Boolean)
        .join(' ')
    : revealed && key !== null
      ? `${t('key')}: ${key.text}`
      : '';

  const verdictBlock =
    checked || revealed ? (
      <div className="flex flex-col gap-[7px]">
        {checked && (
          <Note
            tone={passed ? 'ok' : 'bad'}
            icon={passed ? <Check size={14} /> : <CircleAlert size={14} />}
          >
            <b className="font-semibold">{headline}</b>
          </Note>
        )}
        {focusLines.map((f) => (
          <Note key={f.id} tone="reveal" icon={<Target size={14} />}>
            <b className="font-semibold">{f.word}</b> —{' '}
            {f.why.trim() === '' ? t('focusDefault') : f.why}
          </Note>
        ))}
        {reason.trim() !== '' && (
          <Note tone="reveal" icon={<Info size={14} />}>
            {reason}
          </Note>
        )}
      </div>
    ) : null;

  const live = (
    <p role="status" aria-live="polite" className="sr-only">
      {announcement}
    </p>
  );

  // ── the actions ──────────────────────────────────────────────────────────
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
      {writing &&
        primary(
          sending ? t('checking') : t('check'),
          onCheck,
          // Empty (AC-R4), behind the gate (AC-R5), or resting after a check (Q4-A).
          !interactive || sending || gated || cooling || text.trim() === '',
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
      {closed &&
        primary(
          hasNext ? t('next') : t('finish'),
          hasNext ? onNext : onFinish,
          !interactive || sending,
          undefined,
          <ArrowRight size={14} aria-hidden="true" />,
        )}
      {(verdict !== null || attempt > 1) && (
        <p className="m-0 flex items-center justify-center p-1.5 text-xs text-(--ssz-text-muted)">
          {attemptLine}
        </p>
      )}
      {gated && <AudioLockNote message={t('lockNote')} />}
      {error !== null && (
        <p className="m-0 flex items-start gap-1.5 text-xs" style={{ color: TONE.bad.color }}>
          <CircleAlert size={13} aria-hidden="true" className="mt-0.5 shrink-0" />
          {error}
        </p>
      )}
    </div>
  );

  // The slices of the sentences already closed, in order — never the ones still to be
  // written (plan 68 §3.6).
  const slices = segments
    .map((s) => stateOf(s.id)?.transcriptSlice ?? null)
    .filter((s): s is string => s !== null && s.trim() !== '');
  const transcript = audioOn ? (
    <AudioTranscript
      audio={audio.audio}
      revealed={slices.length > 0}
      delivered={slices.length > 0 ? { transcript: slices.join('\n'), translation: '' } : null}
    />
  ) : null;

  if (desktop) {
    return (
      <div
        ref={root}
        data-layout="desktop"
        className="grid items-start gap-6"
        style={{ gridTemplateColumns: 'minmax(0, 1fr) 300px' }}
      >
        <div className="flex min-w-0 flex-col gap-3">
          <div className="flex flex-col gap-3">
            {title !== undefined && (
              <p className={`m-0 text-(--ssz-text-muted) ${CAPS}`}>
                {title.trim() === '' ? t('untitled') : title}
              </p>
            )}
            {rail}
            {instructionLine}
          </div>
          {field}
          {live}
          {verdictBlock}
          {transcript}
        </div>
        <div className="sticky top-0 flex flex-col gap-3">
          {player}
          <ol className="m-0 flex list-none flex-col gap-0.5 p-0">
            {segments.map((s, k) => {
              const st = stateOf(s.id);
              const now = k === index;
              return (
                <li
                  key={s.id}
                  data-now={now ? 'true' : undefined}
                  aria-current={now ? 'step' : undefined}
                  className="flex items-center gap-[9px] rounded-(--ssz-radius-sm) px-2 py-1.5 text-xs"
                  style={{
                    fontVariantNumeric: 'tabular-nums',
                    background: now ? 'var(--ssz-feedback-key-bg)' : undefined,
                    color: now ? 'var(--ssz-feedback-key-fg)' : 'var(--ssz-text-muted)',
                  }}
                >
                  <Num n={k + 1} />
                  <span>
                    {st?.firstScore != null
                      ? `${Math.round(st.firstScore * 100)}%`
                      : now
                        ? t('listNow')
                        : '—'}
                  </span>
                </li>
              );
            })}
          </ol>
          {actions}
        </div>
      </div>
    );
  }

  return (
    <div ref={root} data-layout="phone" className="flex flex-col gap-3">
      {rail}
      {instructionLine}
      {player}
      {field}
      {live}
      {verdictBlock}
      {transcript}
      <div
        className="sticky bottom-0 z-10 -mx-1 flex flex-col gap-2.5 border-t px-1 pb-2 pt-3"
        style={{ background: 'var(--ssz-bg-surface)', borderColor: 'var(--ssz-border-default)' }}
      >
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

function BlockLabel({ children }: { children: ReactNode }) {
  return (
    <p
      className="m-0 text-[10px] uppercase tracking-(--ssz-tracking-widest) text-(--ssz-text-muted)"
      style={{ fontFamily: 'var(--ssz-font-mono)' }}
    >
      {children}
    </p>
  );
}

function KeyText({ text }: { text: string }) {
  return (
    <p
      className="m-0"
      style={{
        fontFamily: 'var(--ssz-font-reading)',
        fontSize: 'var(--ssz-text-lg)',
        lineHeight: 'var(--ssz-leading-relaxed)',
        color: 'var(--ssz-feedback-key-strong)',
      }}
    >
      {text}
    </p>
  );
}

function Num({ n }: { n: number }) {
  return (
    <span
      className="inline-grid size-[22px] place-items-center rounded-full text-[11px] font-bold"
      style={{ background: 'var(--ssz-bg-muted)', color: 'var(--ssz-text-secondary)' }}
    >
      {n}
    </span>
  );
}

'use client';

import { useState } from 'react';

import {
  Bot,
  Check,
  CircleAlert,
  Clock,
  Info,
  RotateCcw,
  Send,
  TriangleAlert,
  X,
} from 'lucide-react';
import { useTranslations } from 'next-intl';

import type { StudentProjection, StudentResult, Verdict } from '@/lib/shared-kernel/short-answer';

import {
  AudioGateScreen,
  AudioLockNote,
  AudioSegmentButton,
  AudioTranscript,
  ExerciseAudioPlayer,
  type ExerciseAudioEngine,
} from '@/features/student/exercises/audio';

import { Instr } from './instr';

/**
 * Where the runner is in one question — README "Screen 2", state machine.
 *
 * `writing` and `submitted` belong to the question, `done` to the set. Not `RunnerPhase`:
 * the shared `answering | feedback` pair describes an exercise that is checked once, and
 * this one is handed in a question at a time with no way back to any of them.
 */
export type ShortAnswerPhase = 'writing' | 'submitted' | 'done';

/** How the set came out, counted as the answers were handed in. */
export interface ShortAnswerTally {
  pass: number;
  partial: number;
  fail: number;
}

export interface ShortAnswerBodyProps {
  /** The set as the server projected it — never the stored document (it holds the key). */
  set: StudentProjection;
  /** Which question is on screen, 0-based. */
  index: number;
  value: string;
  onValueChange: (value: string) => void;
  phase: ShortAnswerPhase;
  /**
   * The server's verdict for the question on screen, once it has been handed in.
   *
   * Nothing here computes it. The anchor phrases it is derived from are the answer
   * written in the words the student is being asked to find, so they never reach this
   * browser and neither does the grader that reads them (plan 51 §3.2). The builder's
   * preview passes the kernel's own projection of a local grade — the same shape, from
   * the same function the server calls.
   */
  result: StudentResult | null;
  tally: ShortAnswerTally;
  /** True while the hand-in is in flight; the button says so and stays disabled. */
  sending?: boolean;
  /** What went wrong handing the answer in, in the learner's language. */
  error?: string | null;
  /** False in a preview: everything renders, nothing accepts input. */
  interactive?: boolean;
  /**
   * The listening layer, when the set has one (plan 56).
   *
   * Absent means an exercise with no audio, and the body is then exactly what it was
   * before this feature — no player, no gate, no chip.
   */
  audio?: ExerciseAudioEngine;
  /**
   * What the clip said, handed over with the last verdict.
   *
   * Not after the first question: one clip covers the whole set, so a transcript shown
   * mid-set would answer everything still to come. The engine decides that — this only
   * shows what it was given (plan 56 §3.3).
   */
  audioTranscript?: { transcript: string; translation: string } | null;
  /**
   * Whether the set draws its own progress bar. False where something outside it already
   * draws one — the practice stack counts tasks of the section, and two bars measuring
   * different things sat one above the other. The `n/total` counter stays either way:
   * it says where the learner is *inside* the set, which nothing else on that screen
   * says. Ignored when the author turned progress off (`settings.progress`).
   */
  showProgressBar?: boolean;
  onSubmit: () => void;
  onNext: () => void;
  /** Start the set over. Absent where a fresh attempt cannot be had. */
  onRestart?: () => void;
  accent: string;
}

const READING = 'var(--ssz-font-reading)';

const VERDICT_TONE: Record<Verdict | 'wait', { fg: string; bg: string; line: string }> = {
  pass: {
    fg: 'var(--ssz-color-success-700)',
    bg: 'var(--ssz-color-success-50)',
    line: 'var(--ssz-color-success-500)',
  },
  partial: {
    fg: 'var(--ssz-color-warning-700)',
    bg: 'var(--ssz-color-warning-50)',
    line: 'var(--ssz-color-warning-500)',
  },
  fail: {
    fg: 'var(--ssz-color-error-700)',
    bg: 'var(--ssz-color-error-50)',
    line: 'var(--ssz-color-error-500)',
  },
  wait: {
    fg: 'var(--ssz-text-secondary)',
    bg: 'var(--ssz-bg-subtle)',
    line: 'var(--ssz-border-default)',
  },
};

/** ✓ Godkjent / ⓘ Delvis / × Ikke godkjent / ⏱ Til vurdering — icon and word, never colour alone. */
function VerdictChip({ verdict }: { verdict: Verdict | 'wait' }) {
  const t = useTranslations('ExerciseRunner');
  const tone = VERDICT_TONE[verdict];
  const Icon =
    verdict === 'pass' ? Check : verdict === 'partial' ? Info : verdict === 'fail' ? X : Clock;

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold"
      style={{ background: tone.bg, color: tone.fg }}
    >
      <Icon size={13} aria-hidden="true" />
      {t(`shortAnswer.verdict.${verdict}`)}
    </span>
  );
}

/**
 * Which of the things the answer had to say were said.
 *
 * The teacher's labels, and a ✓ or a × against each — never the anchor phrases. The
 * server drops those before answering (`toStudentResult`), so they are not here to leak;
 * this component could not show them if it tried.
 */
function Breakdown({ hits }: { hits: StudentResult['hits'] }) {
  return (
    <ul className="flex list-none flex-col gap-[7px]">
      {hits.map((hit) => (
        <li
          key={hit.id}
          className="flex items-start gap-2 text-[13.5px] leading-snug"
          style={{ color: hit.hit ? 'var(--ssz-color-success-700)' : 'var(--ssz-text-secondary)' }}
        >
          {hit.hit ? (
            <Check size={14} aria-hidden="true" className="mt-0.5 shrink-0" />
          ) : (
            <X size={14} aria-hidden="true" className="mt-0.5 shrink-0" />
          )}
          <span>{hit.label}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * The student's side of `short_answer`: a set of open questions, one at a time, each
 * handed in for good.
 *
 * It renders the question and it owns the text; it decides nothing about the outcome.
 * Every verdict on this screen was computed on the server and arrived with the answer —
 * which is the whole point of the type, since the key is a set of phrasings of the
 * answer itself.
 *
 * One body, deliberately. IMPLEMENTATION.md's rule is that the preview, the "Try as
 * student" page and the player show the same component; a second implementation is how
 * a preview starts lying about what a student sees.
 *
 * **The student sees only the input field** — no word counter, no sentence starter, no
 * hint, no timer. That is the handoff's decision, stated in as many words, and the
 * counter is the one worth naming: `minWords` exists, the too-short line exists, and
 * showing the count would turn a question about understanding into a question about
 * length.
 */
export function ShortAnswerBody({
  set,
  index,
  value,
  onValueChange,
  phase,
  result,
  tally,
  sending = false,
  error = null,
  interactive = true,
  audio,
  audioTranscript = null,
  showProgressBar = true,
  onSubmit,
  onNext,
  onRestart,
  accent,
}: ShortAnswerBodyProps) {
  const t = useTranslations('ExerciseRunner');
  /**
   * The listen-first screen has been passed. State of the body rather than of the engine:
   * it is about this reading of the set, and a restart puts the learner back in front of
   * it because a restart is a new attempt (BEHAVIOR §4).
   */
  const [entered, setEntered] = useState(false);
  const s = set.settings;
  const total = set.questions.length;
  const audioOn = audio !== undefined && audio.audio.enabled;
  // Reaches every control the type owns, by extending the expressions that were already
  // there. A second lock mechanism is how the two drift apart (INTEGRATION.md).
  const locked = audioOn && audio.gated;

  if (total === 0) {
    return (
      <div
        className="rounded-2xl px-6 py-10 text-center"
        style={{ border: '1.5px dashed var(--ssz-border-default)' }}
      >
        <p className="text-[14px] font-semibold text-(--ssz-text-primary)">
          {t('shortAnswer.empty.title')}
        </p>
        <p className="mt-1 text-[12.5px] text-(--ssz-text-muted)">{t('shortAnswer.empty.body')}</p>
      </div>
    );
  }

  if (phase === 'done') {
    const withTeacher = s.teacherReview !== 'none';
    return (
      <div
        className="flex flex-col items-center gap-2.5 px-6 py-10 text-center"
        role="status"
        style={{ color: 'var(--ssz-color-success-700)' }}
      >
        {withTeacher ? (
          <Send size={26} aria-hidden="true" />
        ) : (
          <Check size={26} aria-hidden="true" />
        )}
        <h4 className="m-0 text-[17px] font-bold text-(--ssz-text-primary)">
          {t('shortAnswer.done.title')}
        </h4>
        <p className="m-0 text-[13.5px] text-(--ssz-text-secondary)">
          {t('shortAnswer.done.tally', { ...tally })}
          {withTeacher ? ` ${t('shortAnswer.done.teacher')}` : ''}
        </p>
        {/* A `submit` that could not be confirmed — the answers are in, the set may not
            be closed. Said here rather than swallowed, because the learner is the one
            who can try again. */}
        {error !== null && (
          <p className="text-[12.5px]" style={{ color: 'var(--ssz-feedback-no-fg)' }}>
            {error}
          </p>
        )}
        {onRestart && (
          <button
            type="button"
            onClick={onRestart}
            className="mt-1 inline-flex items-center gap-1.5 rounded-lg border px-4 py-2 text-[13px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ssz-border-focus)"
            style={{ borderColor: 'var(--ssz-border-default)', color: 'var(--ssz-text-secondary)' }}
          >
            <RotateCcw size={13} aria-hidden="true" />
            {t('shortAnswer.done.again')}
          </button>
        )}
      </div>
    );
  }

  /*
    `layout: 'gate'` fills the runner with the listen-first screen instead of the question.
    Below `done`, which is a finished set rather than a clip to hear again, and below the
    empty-set card for the same reason.
  */
  if (audioOn && audio.audio.settings.layout === 'gate' && !entered) {
    return (
      <AudioGateScreen eng={audio} interactive={interactive} onStart={() => setEntered(true)} />
    );
  }

  const question = set.questions[Math.min(index, total - 1)]!;
  const submitted = phase === 'submitted';
  const last = index + 1 >= total;
  // The bar counts the question being answered as done the moment it is handed in, so
  // the last answer fills it rather than leaving the set looking unfinished.
  const progress = ((index + (submitted ? 1 : 0)) / total) * 100;

  const verdict: Verdict | 'wait' = result?.verdict ?? 'wait';
  const tone = VERDICT_TONE[verdict];
  const routingLine = s.aiStage ? t('shortAnswer.routingAi') : t('shortAnswer.routing');

  return (
    <>
      {s.progress && (
        <div className="mb-3 flex items-center gap-3">
          {showProgressBar && (
            <div
              className="h-1 flex-1 overflow-hidden rounded-full"
              style={{ background: 'var(--ssz-bg-muted)' }}
            >
              <i
                className="block h-full transition-[width] duration-500"
                style={{ width: `${progress}%`, background: accent }}
              />
            </div>
          )}
          <span
            className={`text-[12px] font-semibold tabular-nums text-(--ssz-text-muted) ${
              showProgressBar ? 'shrink-0' : 'ml-auto'
            }`}
          >
            {t('shortAnswer.position', { n: index + 1, total })}
          </span>
        </div>
      )}

      {set.instruction.trim() !== '' && <Instr>{set.instruction}</Instr>}

      {audioOn && (
        <div className="mb-3">
          <ExerciseAudioPlayer eng={audio} interactive={interactive} />
          {locked && <AudioLockNote itemNoun={t('audio.itemNoun.questions')} />}
        </div>
      )}

      {/* `reading` only. A `listening` transcript is the author's own and the projection
          never sends it; an `opinion` question has no passage to send. */}
      {question.passage?.trim() && (
        <div
          className="mb-3 px-3.5 py-3 whitespace-pre-wrap"
          style={{
            borderLeft: '2px solid var(--ssz-border-strong)',
            background: 'var(--ssz-bg-subtle)',
            borderRadius: '0 10px 10px 0',
            fontFamily: READING,
            fontSize: 14,
            lineHeight: 1.7,
            color: 'var(--ssz-text-secondary)',
          }}
        >
          {question.passage}
        </div>
      )}

      <h3
        className="mb-3 leading-snug"
        style={{
          fontFamily: READING,
          fontSize: 19,
          fontWeight: 500,
          color: 'var(--ssz-text-primary)',
        }}
      >
        {question.prompt}
      </h3>

      {audioOn && (
        <AudioSegmentButton
          eng={audio}
          segment={audio.segments[question.id] ?? null}
          disabled={!interactive || locked}
        />
      )}

      {/* Read-only rather than disabled once handed in: the answer stays selectable and
          stays readable to assistive technology (README, accessibility). */}
      <textarea
        value={value}
        readOnly={!interactive || submitted || locked}
        aria-label={t('shortAnswer.inputLabel')}
        placeholder={t('shortAnswer.placeholder')}
        onChange={(event) => onValueChange(event.target.value)}
        rows={4}
        style={{
          width: '100%',
          fontFamily: READING,
          fontSize: 16,
          lineHeight: 1.7,
          color: submitted ? 'var(--ssz-text-secondary)' : 'var(--ssz-text-primary)',
          border: `1.5px solid ${submitted ? tone.line : value.trim() ? accent : 'var(--ssz-border-default)'}`,
          borderRadius: 12,
          background: submitted ? 'var(--ssz-bg-base)' : 'var(--ssz-bg-surface)',
          padding: '13px 14px',
          outline: 'none',
          resize: 'vertical',
        }}
      />

      {submitted && result && (
        <div
          role="status"
          className="mt-4 flex flex-col gap-2.5 rounded-xl px-4 py-4"
          style={{ border: `1px solid ${tone.line}`, background: 'var(--ssz-bg-surface)' }}
        >
          <div className="flex flex-wrap items-center gap-2.5">
            <VerdictChip verdict={result.verdict} />
            <span className="text-[12.5px] text-(--ssz-text-muted)">
              {t('shortAnswer.covered', { covered: result.covered, total: result.total })}
            </span>
          </div>

          {result.tooShort && (
            <p
              className="flex items-start gap-1.5 text-[12.5px]"
              style={{ color: 'var(--ssz-color-warning-700)' }}
            >
              <TriangleAlert size={13} aria-hidden="true" className="mt-0.5 shrink-0" />
              {t('shortAnswer.tooShort')}
            </p>
          )}

          {/* Empty when the author switched the breakdown off — the server sends no rows
              at all in that case, rather than rows this component would have to hide. */}
          {result.hits.length > 0 && <Breakdown hits={result.hits} />}

          {/* Plan 51 §3.6: the stage is a switch and a placeholder. Nothing is called,
              and the card says so rather than implying a check that did not happen. */}
          {s.aiStage && (
            <div
              className="flex gap-2 rounded-lg px-3 py-2.5 text-[12.5px] leading-snug"
              style={{
                background: 'var(--ssz-color-info-50)',
                border: '1px solid var(--ssz-color-info-100)',
                color: 'var(--ssz-color-info-700)',
              }}
            >
              <Bot size={14} aria-hidden="true" className="mt-0.5 shrink-0" />
              <span>
                {s.aiGrammar ? t('shortAnswer.aiNoteGrammar') : t('shortAnswer.aiNote')}{' '}
                <span className="font-semibold uppercase">{t('shortAnswer.aiSoon')}</span>
              </span>
            </div>
          )}

          {result.why.trim() !== '' && (
            <p className="text-[13px] leading-relaxed text-(--ssz-text-secondary)">{result.why}</p>
          )}

          {/* Under `showModel: 'never'` this is not hidden here — it never left the
              server (plan 51 §6.1). */}
          {result.model?.trim() && (
            <p
              className="rounded-lg px-3 py-2.5 text-[13.5px] leading-relaxed"
              style={{
                fontFamily: READING,
                background: 'var(--ssz-color-primary-50)',
                color: 'var(--ssz-color-primary-800)',
              }}
            >
              <strong className="font-semibold">{t('shortAnswer.modelLabel')}</strong>{' '}
              {result.model}
            </p>
          )}

          {s.teacherReview !== 'none' && (
            <div
              className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-[12px]"
              style={{
                border: '1px dashed var(--ssz-border-default)',
                background: 'var(--ssz-bg-base)',
                color: 'var(--ssz-text-secondary)',
              }}
            >
              {s.aiStage ? (
                <Bot size={14} aria-hidden="true" className="shrink-0" />
              ) : (
                <Send size={14} aria-hidden="true" className="shrink-0" />
              )}
              {s.teacherReview === 'flagged' && result.verdict === 'pass'
                ? t('shortAnswer.routingIfUnclear', { line: routingLine })
                : routingLine}
            </div>
          )}
        </div>
      )}

      {audioOn && (
        <AudioTranscript
          audio={audio.audio}
          revealed={audioTranscript !== null}
          delivered={audioTranscript}
        />
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        {submitted ? (
          <button
            type="button"
            onClick={onNext}
            className="rounded-xl px-5 py-2.5 text-[14px] font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ssz-border-focus)"
            style={{ background: accent }}
          >
            {last ? t('shortAnswer.finish') : t('shortAnswer.next')}
          </button>
        ) : (
          <>
            <button
              type="button"
              disabled={!interactive || sending || locked || value.trim() === ''}
              onClick={onSubmit}
              className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-[14px] font-bold text-white disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ssz-border-focus)"
              style={{ background: accent }}
            >
              <Send size={14} aria-hidden="true" />
              {sending ? t('shortAnswer.sending') : t('shortAnswer.submit')}
            </button>
            {interactive && (
              <span className="text-[12.5px] text-(--ssz-text-muted)">
                {t('shortAnswer.irreversible')}
              </span>
            )}
          </>
        )}
      </div>

      {error !== null && (
        <p
          className="mt-2 flex items-start gap-1.5 text-[12.5px]"
          style={{ color: 'var(--ssz-feedback-no-fg)' }}
        >
          <CircleAlert size={13} aria-hidden="true" className="mt-0.5 shrink-0" />
          {error}
        </p>
      )}
    </>
  );
}

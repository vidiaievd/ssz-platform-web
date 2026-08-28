'use client';

import { ArrowRight, Check, CircleAlert, Info, RotateCcw, X } from 'lucide-react';
import { useTranslations } from 'next-intl';

import type { StudentProjection } from '@/lib/shared-kernel/multiple-choice';
import type { MultipleChoiceResult } from '@/features/student/exercises/types/attempts';

import { Instr } from './instr';

/**
 * Where the runner is in one question — README "Screen 2", state machine.
 *
 * `picking` and `judged` belong to the question, `done` to the set. The handoff's fourth
 * name, `closed`, is not a phase here but a field on the verdict: the server decides when
 * a question is finished, because that decision is the attempt budget and the budget is
 * the score (plan 53 §3.3).
 */
export type MultipleChoicePhase = 'picking' | 'judged' | 'done';

/** The six visual states of an option — README "Option visual states". */
type OptionState = 'default' | 'sel' | 'ok' | 'bad' | 'key' | 'gone';

export interface MultipleChoiceBodyProps {
  /** The set as the server projected it — never the stored document (it holds the key). */
  set: StudentProjection;
  /** Which question is on screen, 0-based. */
  index: number;
  /** The option under the cursor: picked but not yet handed in, or the one just judged. */
  picked: string | null;
  onPick: (optionId: string) => void;
  phase: MultipleChoicePhase;
  /**
   * The server's verdict for the question on screen, once a pick has been handed in.
   *
   * Nothing here computes it, and nothing here fills in its optional fields. `keyOptionId`
   * and `why` arrive only when the question closes; while a try remains, the correct
   * option is not on this screen to be highlighted (plan 53 §6.1).
   */
  result: MultipleChoiceResult | null;
  /** Which try the open question is on, 1-based. Shown as «Forsøk N». */
  attempt: number;
  /**
   * Options the 50/50 has taken away on this question, cumulative.
   *
   * A prop of its own rather than a field of the verdict, because it outlives the
   * verdict: `Prøv igjen` clears the judgement and keeps what was dimmed (README, "50/50")
   * — a help already spent is not one to hand out again.
   */
  eliminated?: string[];
  /** Questions taken on the first try so far — the score the completion card reports. */
  score: number;
  /** True while a pick is in flight; the button says so and stays disabled. */
  sending?: boolean;
  /** What went wrong handing the pick in, in the learner's language. */
  error?: string | null;
  /** False in a preview: everything renders, nothing accepts input. */
  interactive?: boolean;
  /**
   * Whether the set draws its own progress bar. False where something outside it already
   * draws one — the practice stack counts tasks of the section, and two bars measuring
   * different things sat one above the other. The `n/total` counter stays either way.
   * Ignored when the author turned progress off (`settings.progress`).
   */
  showProgressBar?: boolean;
  /** Hand the current pick in. Absent from the screen entirely under `settings.instant`. */
  onCheck: () => void;
  /** Spend a try: clears the pick, keeps what the 50/50 already dimmed. */
  onRetry: () => void;
  /** «Vis svaret» — closes the question with the key shown, and scores nothing. */
  onReveal: () => void;
  onNext: () => void;
  /** Start the set over. Absent where a fresh attempt cannot be had. */
  onRestart?: () => void;
  accent: string;
}

const READING = 'var(--ssz-font-reading)';
const LETTERS = 'ABCDEFGH';

const STATE_STYLE: Record<OptionState, { border: string; bg: string; fg: string; dashed?: true }> = {
  default: {
    border: 'var(--ssz-border-default)',
    bg: 'var(--ssz-bg-surface)',
    fg: 'var(--ssz-text-primary)',
  },
  sel: {
    border: 'var(--ssz-color-primary-500)',
    bg: 'var(--ssz-color-primary-50)',
    fg: 'var(--ssz-text-primary)',
  },
  ok: {
    border: 'var(--ssz-color-success-500)',
    bg: 'var(--ssz-color-success-50)',
    fg: 'var(--ssz-color-success-700)',
  },
  bad: {
    border: 'var(--ssz-color-error-500)',
    bg: 'var(--ssz-color-error-50)',
    fg: 'var(--ssz-color-error-700)',
  },
  // The key, revealed beside a wrong pick. Dashed rather than filled: it is the answer
  // being shown, not the answer being chosen.
  key: {
    border: 'var(--ssz-color-success-500)',
    bg: 'var(--ssz-bg-surface)',
    fg: 'var(--ssz-color-success-700)',
    dashed: true,
  },
  gone: {
    border: 'var(--ssz-border-default)',
    bg: 'var(--ssz-bg-surface)',
    fg: 'var(--ssz-text-primary)',
  },
};

/**
 * The student's side of `multiple_choice`: a set of questions, one at a time, each with
 * its own budget of tries.
 *
 * It renders the question and it owns nothing about the outcome. Every verdict on this
 * screen came from the engine, and so did the order the options are in — a browser that
 * knew which option was right would make the second try and the 50/50 into decoration,
 * which is the whole reason the key moved to the server (plan 53 §3.2, §3.4).
 *
 * One body, deliberately. IMPLEMENTATION.md's rule is that the preview, the "Try as
 * student" page and the player show the same component; a second implementation is how a
 * preview starts lying about what a student sees.
 *
 * **`Neste oppgave` is not built.** The handoff's completion card offers it, but
 * navigation belongs to the player: these exercises sit in a stack on the practice page,
 * and a card that moved the learner on would be moving them somewhere the page did not
 * agree to. `Gjør på nytt` is built — it is about this attempt (plan 53 §5).
 */
export function MultipleChoiceBody({
  set,
  index,
  picked,
  onPick,
  phase,
  result,
  attempt,
  eliminated = [],
  score,
  sending = false,
  error = null,
  interactive = true,
  showProgressBar = true,
  onCheck,
  onRetry,
  onReveal,
  onNext,
  onRestart,
  accent,
}: MultipleChoiceBodyProps) {
  const t = useTranslations('ExerciseRunner');
  const s = set.settings;
  const total = set.questions.length;

  if (total === 0) {
    return (
      <div
        className="rounded-2xl px-6 py-10 text-center"
        style={{ border: '1.5px dashed var(--ssz-border-default)' }}
      >
        <p className="text-[14px] font-semibold text-(--ssz-text-primary)">
          {t('multipleChoice.empty.title')}
        </p>
        <p className="mt-1 text-[12.5px] text-(--ssz-text-muted)">
          {t('multipleChoice.empty.body')}
        </p>
      </div>
    );
  }

  if (phase === 'done') {
    return (
      <div
        className="flex flex-col items-center gap-2.5 px-6 py-10 text-center"
        role="status"
        style={{ color: 'var(--ssz-color-success-700)' }}
      >
        <Check size={26} aria-hidden="true" />
        <h4 className="m-0 text-[17px] font-bold text-(--ssz-text-primary)">
          {t('multipleChoice.done.title')}
        </h4>
        <p className="m-0 text-[13.5px] text-(--ssz-text-secondary)">
          {t('multipleChoice.done.score', { score, total })}
        </p>
        {/* A `submit` that could not be confirmed — the picks are in, the set may not be
            closed. Said here rather than swallowed, because the learner is the one who
            can try again. */}
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
            {t('multipleChoice.done.again')}
          </button>
        )}
      </div>
    );
  }

  const question = set.questions[Math.min(index, total - 1)]!;
  const judged = phase === 'judged' && result !== null;
  const closed = judged && result.closed;
  const wrongWithTriesLeft = judged && !result.correct && !result.closed;
  const last = index + 1 >= total;
  // The bar counts the question as done the moment it closes, so the last one fills it
  // rather than leaving the set looking unfinished.
  const progress = ((index + (closed ? 1 : 0)) / total) * 100;

  /**
   * What this option looks like right now.
   *
   * The one rule worth stating: `key` is reachable only from `result.keyOptionId`, and
   * the server sends that only once the question is closed. There is no branch here that
   * could reveal the answer early, because there is nothing here that knows it.
   */
  function stateOf(optionId: string): OptionState {
    if (eliminated.includes(optionId)) return 'gone';
    if (!judged) return picked === optionId ? 'sel' : 'default';
    if (optionId === result.optionId && result.optionId !== '') {
      return result.correct ? 'ok' : 'bad';
    }
    if (optionId === result.keyOptionId) return 'key';
    return 'default';
  }

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
            {t('multipleChoice.position', { n: index + 1, total })}
          </span>
        </div>
      )}

      {set.instruction.trim() !== '' && <Instr>{set.instruction}</Instr>}

      {/* `reading`, `grammar`, `vocab`. A `listening` transcript is the author's own and
          the projection never sends it (plan 53 §3.8). */}
      {question.context?.trim() && (
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
          {question.context}
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
        {question.stem}
      </h3>

      {/* `grid` is a wide-screen offer only, and it collapses again under 560px — a phone
          is always a list (README, "Empty and edge states"). */}
      <div
        className={
          s.layout === 'grid'
            ? 'grid grid-cols-1 gap-2 min-[560px]:grid-cols-2'
            : 'flex flex-col gap-2'
        }
      >
        {question.options.map((option, i) => {
          const state = stateOf(option.id);
          const style = STATE_STYLE[state];
          const gone = state === 'gone';
          const disabled = !interactive || gone || closed || sending;

          return (
            <button
              key={option.id}
              type="button"
              disabled={disabled}
              aria-pressed={picked === option.id}
              onClick={() => onPick(option.id)}
              className="flex min-h-12 w-full items-center gap-2.5 rounded-xl px-3.5 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ssz-border-focus) disabled:cursor-default"
              style={{
                border: `1.5px ${style.dashed ? 'dashed' : 'solid'} ${style.border}`,
                background: style.bg,
                color: style.fg,
                fontFamily: READING,
                fontSize: 16,
                lineHeight: 1.4,
                // Colour is never the only signal: an eliminated option is struck
                // through as well as dimmed (README, accessibility).
                opacity: gone ? 0.32 : 1,
                textDecoration: gone ? 'line-through' : 'none',
              }}
            >
              {s.letters ? (
                <span
                  aria-hidden="true"
                  className="grid h-[26px] w-[26px] flex-none place-items-center rounded-lg border text-[11px] font-bold"
                  style={{
                    fontFamily: 'var(--ssz-font-mono)',
                    borderColor: state === 'default' ? 'var(--ssz-border-default)' : style.border,
                    background: state === 'sel' ? style.border : 'var(--ssz-bg-subtle)',
                    color: state === 'sel' ? 'var(--ssz-text-inverse)' : style.fg,
                  }}
                >
                  {LETTERS[i] ?? i + 1}
                </span>
              ) : (
                <span
                  aria-hidden="true"
                  className="h-3.5 w-3.5 flex-none rounded-full"
                  style={{
                    border: `${state === 'sel' ? 5 : 1.5}px solid ${
                      state === 'default' ? 'var(--ssz-border-strong)' : style.border
                    }`,
                  }}
                />
              )}
              <span className="min-w-0 flex-1">{option.text}</span>
              {(state === 'ok' || state === 'key') && (
                <Check size={15} aria-hidden="true" className="flex-none" />
              )}
              {state === 'bad' && <X size={15} aria-hidden="true" className="flex-none" />}
            </button>
          );
        })}
      </div>

      {judged && (
        <Feedback
          result={result}
          generic={t('multipleChoice.generic')}
          rightLabel={t('multipleChoice.right')}
        />
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        {!judged &&
          (s.instant ? (
            <p className="text-[12.5px] text-(--ssz-text-muted)">{t('multipleChoice.tapAnswer')}</p>
          ) : (
            <button
              type="button"
              disabled={!interactive || sending || picked === null}
              onClick={onCheck}
              className="rounded-xl px-5 py-2.5 text-[14px] font-bold text-white disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ssz-border-focus)"
              style={{ background: accent }}
            >
              {sending ? t('multipleChoice.checking') : t('multipleChoice.check')}
            </button>
          ))}

        {wrongWithTriesLeft && (
          <>
            <button
              type="button"
              disabled={!interactive || sending}
              onClick={onRetry}
              className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-[14px] font-bold text-white disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ssz-border-focus)"
              style={{ background: accent }}
            >
              <RotateCcw size={14} aria-hidden="true" />
              {t('multipleChoice.tryAgain')}
            </button>
            <button
              type="button"
              disabled={!interactive || sending}
              onClick={onReveal}
              className="rounded-lg border px-4 py-2 text-[13px] font-semibold disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ssz-border-focus)"
              style={{
                borderColor: 'var(--ssz-border-default)',
                color: 'var(--ssz-text-secondary)',
              }}
            >
              {t('multipleChoice.showAnswer')}
            </button>
          </>
        )}

        {closed && (
          <button
            type="button"
            onClick={onNext}
            className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-[14px] font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ssz-border-focus)"
            style={{ background: accent }}
          >
            {last ? t('multipleChoice.finish') : t('multipleChoice.next')}
            <ArrowRight size={14} aria-hidden="true" />
          </button>
        )}

        {judged && (
          <p className="ml-auto text-[12.5px] text-(--ssz-text-muted)">
            {t('multipleChoice.attempt', { n: attempt })}
          </p>
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

/**
 * The block under the options — README "Feedback block", three rows of one table.
 *
 * What it can say is decided entirely by what the server sent. `why` arrives only with a
 * closed question; `optionWhy` only when the author asked for rebuttals and wrote one for
 * the option that was picked. Neither is defaulted here: the generic line stands in when
 * a wrong pick has nothing written against it, and nothing stands in for a rule that was
 * withheld — a rule not sent is a question not finished.
 */
function Feedback({
  result,
  generic,
  rightLabel,
}: {
  result: MultipleChoiceResult;
  generic: string;
  rightLabel: string;
}) {
  const tone = result.correct
    ? { bg: 'var(--ssz-color-success-50)', fg: 'var(--ssz-color-success-700)' }
    : result.closed
      ? { bg: 'var(--ssz-color-primary-50)', fg: 'var(--ssz-color-primary-700)' }
      : { bg: 'var(--ssz-color-error-50)', fg: 'var(--ssz-color-error-700)' };
  const Icon = result.correct ? Check : result.closed ? Info : X;

  return (
    <div
      role="status"
      className="mt-2 flex gap-2 rounded-lg px-3 py-2.5 text-[13.5px] leading-snug"
      style={{ background: tone.bg, color: tone.fg }}
    >
      <Icon size={14} aria-hidden="true" className="mt-0.5 shrink-0" />
      <div>
        {result.correct && <b className="font-semibold">{rightLabel}</b>}
        {result.optionWhy?.trim() && (
          <div className={result.correct ? 'mt-1' : ''}>{result.optionWhy}</div>
        )}
        {/* Nothing written against this option, and nothing to say yet — the question is
            still open, so the rule is not here to fall back on. */}
        {!result.correct && !result.optionWhy?.trim() && !result.why?.trim() && <div>{generic}</div>}
        {result.why?.trim() && (
          <div className={result.correct || result.optionWhy?.trim() ? 'mt-1' : ''}>
            {result.why}
          </div>
        )}
      </div>
    </div>
  );
}

'use client';

import { useMemo, useState } from 'react';
import { ListChecks } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { useExerciseForRunner } from '@/features/content/api/use-exercise';
import { primaryHintText, primaryInstructionText } from '@/features/content/lib/instruction-text';
import { ErrorCorrectionSolver } from './error-correction-solver';
import { GapFillSolver } from './gap-fill-solver';
import { MatchPairsSolver } from './match-pairs-solver';
import { MultipleChoiceGroupSolver } from './multiple-choice-group-solver';
import { MultipleChoiceSolver } from './multiple-choice-solver';
import { ShortAnswerSolver } from './short-answer-solver';
import { TranslateSolver } from './translate-solver';
import { WritingTaskSolver } from './writing-task-solver';
import type { ExerciseWithAnswers } from '@/features/content/types';
import { isMultipleChoiceDocument } from '@/lib/shared-kernel/multiple-choice';
import { isShortAnswerDocument, readContent } from '@/lib/shared-kernel/short-answer';
import {
  gradedInBrowser,
  type ClientGradedTemplate,
} from '@/features/student/exercises/lib/grading-side';
import { ErrorState, LearningSkeleton } from '@/features/learning';
import { SentenceSchemaSolver } from './sentence-schema-solver';
import {
  McqBody,
  McqGroupBody,
  keepCorrectPicks,
  checkMcqGroup,
  FillBody,
  ShortAnswerLegacyBody,
  WordBankFillBody,
  checkWordBankFill,
  keepCorrectBlanks,
  TextOrderBody,
  checkTextOrder,
  shuffleOrder,
  gradeMcq,
  checkShortAnswer,
  normAnswer,
  readSentenceSchemaProjection,
  readMultipleChoiceProjection,
  PRACTICE_ACCENT,
  type McqContent,
  type McqGroupExpectedAnswers,
  type McqGroupOption,
  type McqGroupQuestion,
  type McqGroupResults,
  type McqGroupValue,
  type FillRationale,
  type WordBankFillExpectedAnswers,
  type WordBankFillResults,
  type WordBankFillValue,
  type WordBankSentence,
  type OrderLine,
  type TextOrderResults,
  type WordNotes,
  type DiffToken,
  type ShortAnswerDiff,
} from '@/features/student/exercises/runner';

/* ── types ──────────────────────────────────────────────────────────────── */

/** Grading outcome: true = correct, false = wrong, null = routed for review. */
type Ok = boolean | null;

interface Graded {
  ok: Ok;
  /**
   * Shown as soon as the answer is checked — a tally or a status line, never
   * anything that gives the answer away.
   */
  summary?: string;
  /** The rule behind the answer; held back until the answer is unlocked. */
  explanation?: string;
  /** A reference/sample answer; held back until the answer is unlocked. */
  reference?: string;
}

interface SolverProps {
  display: ExerciseWithAnswers;
  phase: 'answering' | 'feedback';
  ok: Ok;
  /** True once the learner has used up their attempts or asked to see it. */
  revealed: boolean;
  /**
   * Bumped by every retry. Solvers that can hand back a partly-filled exercise
   * watch it and drop just the wrong answers; the rest ignore it and keep what
   * the learner had.
   */
  retryNonce: number;
  onCheck: (graded: Graded) => void;
}

const ACCENT = PRACTICE_ACCENT;

/* ── helpers ────────────────────────────────────────────────────────────── */

const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const strArr = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
const instr = (d: ExerciseWithAnswers): string | undefined =>
  primaryInstructionText(d.instructions) ?? undefined;
/** `content.word_notes` — a bank word → why it does or doesn't fit. */
const wordNotes = (v: unknown): WordNotes | undefined => {
  if (typeof v !== 'object' || v === null) return undefined;
  const entries = Object.entries(v).filter((e): e is [string, string] => typeof e[1] === 'string');
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
};

function CheckFooter({ canSubmit, onCheck }: { canSubmit: boolean; onCheck: () => void }) {
  const t = useTranslations('ExerciseRunner');
  return (
    <div className="mt-6 flex justify-end border-t border-(--ssz-border-default) pt-4">
      <button
        type="button"
        disabled={!canSubmit}
        onClick={onCheck}
        className="inline-flex items-center rounded-xl bg-(--ssz-color-primary-500) px-7 py-3 text-[15px] font-bold text-white transition-colors hover:bg-(--ssz-color-primary-600) disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ssz-border-focus)"
      >
        {t('check')}
      </button>
    </div>
  );
}

/* ── per-type solvers ───────────────────────────────────────────────────── */

/**
 * The single-question form, still live under 121 seeded exercises (plan 53 §8 Q2).
 *
 * Untouched by the rewrite and dispatched to by document shape rather than by template
 * code — a set of questions goes to `MultipleChoiceSolver` and is graded on the server.
 * This one keeps the key in the browser, as it always has: its whole check is a
 * comparison of option ids, and there is no second try to dose.
 */
function McqLegacySolver({ display, phase, ok, onCheck }: SolverProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const c = display.content;
  const options = useMemo(
    () =>
      (Array.isArray(c.options) ? c.options : [])
        .filter(
          (o): o is { id: string; text: string } => typeof (o as { id?: unknown }).id === 'string',
        )
        .map((o) => ({ id: o.id, text: str(o.text) })),
    [c.options],
  );
  const content: McqContent = { question: str(c.question), options, instruction: instr(display) };
  const correctIds = strArr(display.expectedAnswers.correct_option_ids);

  return (
    <>
      <McqBody
        content={content}
        expectedAnswers={{ correct_option_ids: correctIds }}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onAnswerChange={() => {}}
        phase={phase}
        ok={ok}
        mode="practice"
        accent={ACCENT}
      />
      {phase === 'answering' && (
        <CheckFooter
          canSubmit={selectedId !== null}
          onCheck={() =>
            onCheck({
              ok: gradeMcq({ correct_option_ids: correctIds }, selectedId),
              explanation: str(display.expectedAnswers.explanation) || undefined,
            })
          }
        />
      )}
    </>
  );
}

function McqGroupSolver({ display, phase, ok, revealed, retryNonce, onCheck }: SolverProps) {
  const [value, setValue] = useState<McqGroupValue>({});
  const [results, setResults] = useState<McqGroupResults>({});
  const [canSubmit, setCanSubmit] = useState(false);
  const [seenRetry, setSeenRetry] = useState(retryNonce);
  if (retryNonce !== seenRetry) {
    // The questions answered right keep their pick; the misses come back blank.
    setSeenRetry(retryNonce);
    setValue(keepCorrectPicks(value, results));
    setResults({});
  }
  const t = useTranslations('ExerciseRunner');
  const c = display.content;

  const options = (v: unknown): McqGroupOption[] =>
    (Array.isArray(v) ? v : [])
      .filter(
        (o): o is { id: string; text: string } => typeof (o as { id?: unknown }).id === 'string',
      )
      .map((o) => ({ id: o.id, text: str(o.text) }));

  const items: McqGroupQuestion[] = (Array.isArray(c.items) ? c.items : [])
    .filter(
      (it): it is { id: string; question: string; options?: unknown } =>
        typeof (it as { id?: unknown }).id === 'string',
    )
    .map((it) => {
      const own = options(it.options);
      return { id: it.id, question: str(it.question), ...(own.length > 0 && { options: own }) };
    });

  const expected: McqGroupExpectedAnswers = {
    items: (Array.isArray(display.expectedAnswers.items) ? display.expectedAnswers.items : [])
      .filter(
        (it): it is { id: string; correct_option_ids: unknown; explanation?: unknown } =>
          typeof (it as { id?: unknown }).id === 'string',
      )
      .map((it) => ({
        id: it.id,
        correct_option_ids: strArr(it.correct_option_ids),
        ...(str(it.explanation) && { explanation: str(it.explanation) }),
      })),
  };

  return (
    <>
      <McqGroupBody
        content={{
          items,
          options: options(c.options),
          instruction: instr(display),
          context: str(c.context) || undefined,
        }}
        value={value}
        onValueChange={setValue}
        onAnswerChange={setCanSubmit}
        phase={phase}
        ok={ok}
        mode="practice"
        accent={ACCENT}
        results={results}
        revealed={revealed}
      />
      {phase === 'answering' && (
        <CheckFooter
          canSubmit={canSubmit}
          onCheck={() => {
            const graded = checkMcqGroup(expected, value);
            setResults(graded.results);
            onCheck({
              ok: graded.ok,
              summary: graded.ok
                ? undefined
                : t('mcqGroup.partialScore', { correct: graded.correct, total: graded.total }),
              explanation: str(display.expectedAnswers.explanation) || undefined,
            });
          }}
        />
      )}
    </>
  );
}

function FillSolver({ display, phase, ok, revealed, retryNonce, onCheck }: SolverProps) {
  const [value, setValue] = useState('');
  const [seenRetry, setSeenRetry] = useState(retryNonce);
  if (retryNonce !== seenRetry) {
    // Adjusting state during render — the sanctioned way to react to a prop
    // change without an extra pass. Only the missed blank exists here, so it
    // starts over empty.
    setSeenRetry(retryNonce);
    setValue('');
  }
  const c = display.content;
  const rawBlanks = Array.isArray(display.expectedAnswers.blanks)
    ? display.expectedAnswers.blanks
    : [];
  const firstBlank = rawBlanks[0] as
    | { accepted_answers?: unknown; rationale?: FillRationale }
    | undefined;
  const firstAccepted = strArr(firstBlank?.accepted_answers);

  return (
    <>
      <FillBody
        content={{
          textWithBlanks: str(c.text_with_blanks),
          wordBank: strArr(c.word_bank).length > 0 ? strArr(c.word_bank) : undefined,
          instruction: instr(display),
          wordNotes: wordNotes(c.word_notes),
        }}
        value={value}
        onValueChange={setValue}
        onAnswerChange={() => {}}
        phase={phase}
        ok={ok}
        mode="practice"
        accent={ACCENT}
        rationale={firstBlank?.rationale}
        correctAnswer={firstAccepted[0] ?? ''}
        revealed={revealed}
      />
      {phase === 'answering' && (
        <CheckFooter
          canSubmit={value.trim() !== ''}
          onCheck={() =>
            onCheck({
              ok: firstAccepted.some((a) => normAnswer(a) === normAnswer(value)),
              reference: firstAccepted[0],
              explanation: str(display.expectedAnswers.explanation) || undefined,
            })
          }
        />
      )}
    </>
  );
}

/**
 * The single-question form, graded in the browser against a list of accepted strings.
 *
 * Still the shape of 144 seeded exercises (plan 51 §8 Q1), and untouched by this plan:
 * those documents carry no semantic key, so there is nothing for the server grader to
 * read. Which runner a learner gets is decided by the shape of the document, in
 * `gradedOnServer` below — never by the template code, which is the same for both.
 */
function ShortAnswerLegacySolver({ display, phase, ok, retryNonce, onCheck }: SolverProps) {
  const t = useTranslations('ExerciseRunner');
  const [value, setValue] = useState('');
  const [diff, setDiff] = useState<DiffToken[] | null>(null);
  const [seenRetry, setSeenRetry] = useState(retryNonce);
  if (retryNonce !== seenRetry) {
    // A new go starts clean — last round's marks would sit under a fresh answer.
    setSeenRetry(retryNonce);
    setDiff(null);
  }
  const c = display.content;
  const ea = display.expectedAnswers;
  const reference = str(ea.reference_answer);

  return (
    <>
      <ShortAnswerLegacyBody
        content={{
          question: str(c.question),
          context: str(c.context) || undefined,
          instruction: instr(display),
        }}
        value={value}
        onValueChange={setValue}
        onAnswerChange={() => {}}
        phase={phase}
        ok={ok}
        mode="practice"
        accent={ACCENT}
        referenceAnswer={reference || undefined}
        diff={diff ?? undefined}
      />
      {phase === 'answering' && (
        <CheckFooter
          canSubmit={value.trim() !== ''}
          onCheck={() => {
            const checked = checkShortAnswer(
              { reference_answer: reference, accepted_answers: strArr(ea.accepted_answers) },
              value,
            );
            /* A near miss is worth marking up word by word. An answer that is
               nowhere near still goes to a teacher — it may be a phrasing the
               author never listed, and striking it through would be a lie. */
            setDiff(checked.ok === null ? null : checked.tokens);
            onCheck({
              ok: checked.ok,
              summary: checked.ok === false ? issueSummary(t, checked.counts) : undefined,
              explanation: str(ea.explanation) || undefined,
              reference: reference || undefined,
            });
          }}
        />
      )}
    </>
  );
}

/** "wrong form: 1 · missing word: 1" — what to fix, without giving the words. */
function issueSummary(
  t: ReturnType<typeof useTranslations<'ExerciseRunner'>>,
  counts: ShortAnswerDiff['counts'],
): string | undefined {
  const parts = (['form', 'wrong', 'missing', 'extra'] as const)
    .filter((kind) => counts[kind] > 0)
    .map((kind) => t(`shortAnswer.issues.${kind}`, { n: counts[kind] }));
  return parts.length > 0 ? parts.join(' · ') : undefined;
}

function WordBankFillSolver({ display, phase, ok, revealed, retryNonce, onCheck }: SolverProps) {
  const [value, setValue] = useState<WordBankFillValue>({});
  const [results, setResults] = useState<WordBankFillResults>({});
  const [canSubmit, setCanSubmit] = useState(false);
  const [seenRetry, setSeenRetry] = useState(retryNonce);
  if (retryNonce !== seenRetry) {
    // The blanks already answered right stay filled; the misses come back empty.
    setSeenRetry(retryNonce);
    setValue(keepCorrectBlanks(value, results));
    setResults({});
  }
  const t = useTranslations('ExerciseRunner');
  const c = display.content;

  const wordBank = strArr(c.word_bank);
  const items: WordBankSentence[] = (Array.isArray(c.items) ? c.items : [])
    .filter(
      (it): it is { id: string; text_with_blanks: string } =>
        typeof (it as { id?: unknown }).id === 'string',
    )
    .map((it) => ({ id: it.id, textWithBlanks: str(it.text_with_blanks) }));

  const expected: WordBankFillExpectedAnswers = {
    items: (Array.isArray(display.expectedAnswers.items) ? display.expectedAnswers.items : [])
      .filter(
        (it): it is { id: string; blanks: unknown } =>
          typeof (it as { id?: unknown }).id === 'string',
      )
      .map((it) => ({
        id: it.id,
        blanks: (Array.isArray(it.blanks) ? it.blanks : [])
          .filter(
            (b): b is { blank_id: number; accepted_answers: unknown; rationale?: FillRationale } =>
              typeof (b as { blank_id?: unknown }).blank_id === 'number',
          )
          .map((b) => ({
            blank_id: b.blank_id,
            accepted_answers: strArr(b.accepted_answers),
            ...(b.rationale ? { rationale: b.rationale } : {}),
          })),
      })),
  };

  return (
    <>
      <WordBankFillBody
        content={{
          wordBank,
          items,
          instruction: instr(display),
          reusableWords: c.reusable_words === true,
          wordNotes: wordNotes(c.word_notes),
          inputMode: c.input_mode === 'select' ? 'select' : 'chips',
        }}
        value={value}
        onValueChange={setValue}
        onAnswerChange={setCanSubmit}
        phase={phase}
        ok={ok}
        mode="practice"
        accent={ACCENT}
        results={results}
        revealed={revealed}
      />
      {phase === 'answering' && (
        <CheckFooter
          canSubmit={canSubmit}
          onCheck={() => {
            const graded = checkWordBankFill(expected, value);
            setResults(graded.results);
            onCheck({
              ok: graded.ok,
              summary: graded.ok
                ? undefined
                : t('wordBank.partialScore', { correct: graded.correct, total: graded.total }),
              explanation: str(display.expectedAnswers.explanation) || undefined,
            });
          }}
        />
      )}
    </>
  );
}

function TextOrderSolver({ display, phase, ok, onCheck }: SolverProps) {
  const t = useTranslations('ExerciseRunner');
  const c = display.content;

  const items: OrderLine[] = useMemo(
    () =>
      (Array.isArray(c.items) ? c.items : [])
        .filter(
          (it): it is { id: string; text: string; speaker?: string } =>
            typeof (it as { id?: unknown }).id === 'string',
        )
        .map((it) => ({
          id: it.id,
          text: str(it.text),
          ...(str(it.speaker) && { speaker: str(it.speaker) }),
        })),
    [c.items],
  );

  // Seeded by the exercise id: reloading the page re-poses the same puzzle.
  const [value, setValue] = useState<string[]>(() =>
    shuffleOrder(
      items.map((i) => i.id),
      display.id,
    ),
  );
  const [results, setResults] = useState<TextOrderResults>({});
  const [canSubmit, setCanSubmit] = useState(false);

  const expectedOrder = strArr(display.expectedAnswers.order);

  return (
    <>
      <TextOrderBody
        content={{
          items,
          kind: c.kind === 'sentences' ? 'sentences' : 'dialogue',
          instruction: instr(display),
        }}
        value={value}
        onValueChange={setValue}
        onAnswerChange={setCanSubmit}
        phase={phase}
        ok={ok}
        mode="practice"
        accent={ACCENT}
        results={results}
      />
      {phase === 'answering' && (
        <CheckFooter
          canSubmit={canSubmit}
          onCheck={() => {
            const graded = checkTextOrder({ order: expectedOrder }, value);
            setResults(graded.results);
            onCheck({
              ok: graded.ok,
              summary: graded.ok
                ? undefined
                : t('textOrder.partialScore', { correct: graded.correct, total: graded.total }),
              explanation: str(display.expectedAnswers.explanation) || undefined,
            });
          }}
        />
      )}
    </>
  );
}

/* ── feedback banner ────────────────────────────────────────────────────── */

interface FeedbackBannerProps {
  graded: Graded;
  /** Held-back material is shown only once this is true. */
  revealed: boolean;
  /** Authored hint, offered instead of the answer on a first miss. */
  hint?: string;
  onRetry: () => void;
  onToggleReveal: () => void;
}

function FeedbackBanner({ graded, revealed, hint, onRetry, onToggleReveal }: FeedbackBannerProps) {
  const t = useTranslations('ExerciseRunner');
  const { ok, summary, explanation, reference } = graded;
  /* Every miss is worth another go, and the answers stay one click away for as
     long as any blank is wrong — a learner on their third attempt needs that
     way out as much as on their first. Showing them is a toggle, not a one-way
     door. Both are off in graded mode (ok === null), where the answer is
     already with the teacher. */
  const canRetry = ok === false;
  const tone =
    ok === true
      ? {
          bg: 'var(--ssz-feedback-ok-bg)',
          line: 'var(--ssz-feedback-ok-line)',
          fg: 'var(--ssz-feedback-ok-fg)',
          label: t('feedback.correct'),
        }
      : ok === false
        ? {
            bg: 'var(--ssz-feedback-no-bg)',
            line: 'var(--ssz-feedback-no-line)',
            fg: 'var(--ssz-feedback-no-fg)',
            label: t('feedback.incorrect'),
          }
        : {
            bg: 'var(--ssz-color-secondary-100)',
            line: 'var(--ssz-color-secondary-600)',
            fg: 'var(--ssz-color-secondary-700)',
            label: t('feedback.submitted'),
          };

  return (
    <div
      className="mt-6 rounded-xl px-4 py-3.5"
      style={{ background: tone.bg, border: `1.5px solid ${tone.line}` }}
    >
      <p className="text-[14px] font-bold" style={{ color: tone.fg }}>
        {tone.label}
      </p>
      {ok === null && (
        <p className="mt-0.5 text-[13px]" style={{ color: 'var(--ssz-text-secondary)' }}>
          {t('feedback.gradedNote')}
        </p>
      )}
      {summary && (
        <p className="mt-1.5 text-[13.5px]" style={{ color: 'var(--ssz-text-secondary)' }}>
          {summary}
        </p>
      )}
      {!revealed && hint && (
        <p className="mt-1.5 text-[13.5px]" style={{ color: 'var(--ssz-text-secondary)' }}>
          {hint}
        </p>
      )}
      {revealed && explanation && (
        <p className="mt-1.5 text-[13.5px]" style={{ color: 'var(--ssz-text-secondary)' }}>
          {explanation}
        </p>
      )}
      {revealed && ok === false && reference && (
        <p className="mt-1.5 text-[13.5px]" style={{ color: 'var(--ssz-text-secondary)' }}>
          {t('feedback.answerLabel')} <span className="font-semibold">{reference}</span>
        </p>
      )}
      {canRetry && (
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onRetry}
            className="rounded-lg px-4 py-2 text-[13.5px] font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ssz-border-focus)"
            style={{ background: tone.line }}
          >
            {t('feedback.tryAgain')}
          </button>
          <button
            type="button"
            onClick={onToggleReveal}
            className="rounded-lg border px-4 py-2 text-[13.5px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ssz-border-focus)"
            style={{ borderColor: tone.line, color: tone.fg }}
          >
            {revealed ? t('feedback.hideAnswer') : t('feedback.showAnswer')}
          </button>
        </div>
      )}
    </div>
  );
}

/* ── public component ───────────────────────────────────────────────────── */

/**
 * The templates checked in the browser, and the runners that check them.
 *
 * Typed by `ClientGradedTemplate` rather than by `string`, so this map and the list the
 * BFF withholds answer keys by cannot drift: a solver added here without its code in
 * `CLIENT_GRADED_TEMPLATES` does not compile, and a code listed there without a solver
 * here does not either. The two used to be the same fact stated once and read nowhere —
 * the reader asked for every key and sorted it out afterwards.
 */
const SOLVERS: Record<ClientGradedTemplate, (props: SolverProps) => React.ReactElement> = {
  multiple_choice: McqLegacySolver,
  multiple_choice_group: McqGroupSolver,
  fill_in_blank: FillSolver,
  short_answer: ShortAnswerLegacySolver,
  word_bank_fill: WordBankFillSolver,
  text_order: TextOrderSolver,
};

/**
 * The templates graded on the server, which are therefore not `SolverProps` solvers at
 * all: they are never handed the answers, because for these the answers are the
 * exercise — the words missing from the sentences, the half that completes each line,
 * the mistakes to be found, the accepted translations. Each drives its own attempt
 * against the engine.
 */
const SERVER_SOLVERS: Record<
  string,
  (props: {
    exerciseId: string;
    language: string;
    instruction?: string;
    onChecked?: (ok: Ok) => void;
    /** True when this runner is one card in a stack of tasks; see `ExerciseSolverProps`. */
    stacked?: boolean;
  }) => React.ReactElement
> = {
  word_bank_gap_fill: GapFillSolver,
  match_pairs: MatchPairsSolver,
  error_correction: ErrorCorrectionSolver,
  translate_to_target: TranslateSolver,
  translate_from_target: TranslateSolver,
  // Not because its answers are secret — a written text has no answers — but because
  // the task's own answer key is: the model answer and the point keywords never leave
  // the server, and the attempt is where the draft and the teacher's verdict live.
  writing_task: WritingTaskSolver,
  // Its key is a set of anchor phrases — the answer written in the words the student is
  // being asked to find — and the set is handed in a question at a time, each answer
  // graded and recorded where the key is (plan 51 §3.2). Only documents of the new form
  // arrive here; see `gradedOnServer`.
  short_answer: ShortAnswerSolver,
  // Its key is which field each piece belongs in, and the note under the board is
  // resolved from the author's own per-chunk notes — so the marks come from the engine,
  // one sentence at a time, with unlimited retries per sentence (plan 52 §3.2).
  sentence_schema: SentenceSchemaSolver,
  // The only one here whose key is not the exercise — an option id gives nothing away by
  // itself. It is on the server because the *dosing* is: a second try and a 50/50 offered
  // by a browser that already knows the right option are decoration, and the order the
  // options arrive in is dealt per attempt for the same reason (plan 53 §3.2, §3.4).
  // Only documents of the new form arrive here; see `gradedOnServer`.
  multiple_choice: MultipleChoiceSolver,
  // Its key is which shared column each statement belongs in, and it is on the server for
  // the dosing rather than the secrecy: the retry budget, the freeze on rows that came out
  // right and the moment the key becomes visible are all decisions a browser holding the
  // answers could not make honestly (plan 54 §3.2, §3.3). Only documents of the new form
  // arrive here; see `gradedOnServer`.
  multiple_choice_group: MultipleChoiceGroupSolver,
};

/**
 * Which runner this exercise gets, when the template alone does not decide.
 *
 * `short_answer` has two live document shapes and one template code: the new set of open
 * questions, graded on the server, and the 144 single-question exercises still written
 * in the old form, graded in the browser against accepted strings (plan 51 §8 Q1). The
 * document says which is which — `content.questions` exists in one and cannot exist in
 * the other — and the same test decides it in the validator and in the projections.
 *
 * `multiple_choice` and `multiple_choice_group` are the same arrangement, for the two
 * shapes each of them has live (plan 53 §3.9, plan 54 §3.2).
 */
function gradedOnServer(data: ExerciseWithAnswers): boolean {
  if (SERVER_SOLVERS[data.templateCode] === undefined) return false;
  // The same predicate the BFF withholds keys by, read the other way round: a document
  // the browser does not grade is one the server does.
  return !gradedInBrowser(data.templateCode, data.content);
}

/**
 * How many questions this exercise is a set of, or `null` when it is a single task.
 *
 * Three templates are sets: `short_answer`, one card holding several questions handed in
 * one at a time; `sentence_schema`, one card holding several sentences checked one at a
 * time; and `multiple_choice`, one card holding several questions each with its own
 * budget of tries. The practice stack is built on "one task, one Check", so a
 * set has to announce itself there rather than unfold into a player nobody asked to
 * start (plan 51 phase 4 follow-up).
 */
function setSize(data: ExerciseWithAnswers): number | null {
  if (data.templateCode === 'sentence_schema') {
    const set = readSentenceSchemaProjection(data.content);
    return set === null ? null : set.rows.length;
  }
  if (data.templateCode === 'multiple_choice') {
    if (!isMultipleChoiceDocument(data.content)) return null;
    const set = readMultipleChoiceProjection(data.content);
    return set === null ? null : set.questions.length;
  }
  if (data.templateCode !== 'short_answer') return null;
  if (!isShortAnswerDocument(data.content)) return null;
  return readContent(data.content).questions.length;
}

/**
 * The single line a folded set shows above its start button: the instruction in the
 * learner's language when the author wrote one, otherwise the set's own words — its title
 * where it has one, its own instruction where it does not. Never both: the folded card is
 * a promise of what is inside, not a preview of it.
 */
function foldedLine(data: ExerciseWithAnswers): string {
  const instruction = instr(data);
  if (instruction !== undefined && instruction.trim() !== '') return instruction;
  // The code as well as the shape: `isShortAnswerDocument` only asks whether `questions`
  // is an array, and since plan 53 a `multiple_choice` set answers yes to that too — which
  // sent it down this branch and folded it under its teacher-facing title.
  if (data.templateCode === 'short_answer' && isShortAnswerDocument(data.content)) {
    return readContent(data.content).title.trim();
  }
  // `multiple_choice` has no title in its projection — the set's own instruction, in the
  // language being learned, is the closest thing to a promise of what is inside.
  if (data.templateCode === 'multiple_choice') {
    return readMultipleChoiceProjection(data.content)?.instruction.trim() ?? '';
  }
  return '';
}

export interface ExerciseSolverProps {
  exerciseId: string;
  /** 1-based position, shown when the exercise is one task of a practice set. */
  index?: number;
  /** Fired once, when the learner checks this exercise. */
  onChecked?: (ok: Ok) => void;
  /**
   * True when this is one card in a stack of tasks rather than the whole screen. A set
   * then stays folded until the learner starts it — which also keeps the stack from
   * opening an attempt on every set the moment the section loads — and drops the chrome
   * the page around it already provides.
   */
  stacked?: boolean;
}

/**
 * One exercise: load → dispatch by template → grade client-side → feedback.
 * Used on its own (`ExercisePage`) and stacked by the practice page.
 */
export function ExerciseSolver({ exerciseId, index, onChecked, stacked }: ExerciseSolverProps) {
  const t = useTranslations('ExerciseRunner');
  const { data, isLoading, isError, refetch } = useExerciseForRunner(exerciseId);
  const [phase, setPhase] = useState<'answering' | 'feedback'>('answering');
  const [graded, setGraded] = useState<Graded | null>(null);
  /* Attempts are unlimited; the answers appear only when asked for. */
  const [attempts, setAttempts] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [retryNonce, setRetryNonce] = useState(0);
  /** A set in a stack opens on request; everywhere else it is open from the start. */
  const [opened, setOpened] = useState(false);

  // Per-item state is reset by remounting: the reader passes key={exerciseId}.

  if (isLoading) return <LearningSkeleton variant="list" rows={4} />;
  if (isError || !data) return <ErrorState onRetry={() => refetch()} />;

  // Server-graded, and therefore not a `SolverProps` solver at all: it never has
  // the answers to pass down. Branching here keeps the other twelve untouched —
  // moving them to server-side grading is separate work with a shape of its own.
  const ServerSolver = SERVER_SOLVERS[data.templateCode];
  if (ServerSolver !== undefined && gradedOnServer(data)) {
    const questions = setSize(data);
    // A set inside the stack: it says what it is, and waits to be started.
    const folded = stacked === true && questions !== null && !opened;

    return (
      <div>
        {index != null && (
          <div className="mb-2 text-[12px] font-bold text-(--ssz-text-muted)">
            {t('taskNumber', { n: index })}
          </div>
        )}
        {questions !== null && stacked === true && (
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-semibold"
              style={{ background: 'var(--ssz-bg-subtle)', color: 'var(--ssz-text-secondary)' }}
            >
              <ListChecks size={12} aria-hidden="true" />
              {t('set.badge')}
            </span>
            <span className="text-[12px] text-(--ssz-text-muted)">
              {t('set.count', { n: questions })}
            </span>
          </div>
        )}
        {folded ? (
          <>
            {foldedLine(data) !== '' && (
              <p className="mb-4 text-[14px] leading-relaxed text-(--ssz-text-secondary)">
                {foldedLine(data)}
              </p>
            )}
            <button
              type="button"
              onClick={() => setOpened(true)}
              className="rounded-xl px-5 py-2.5 text-[14px] font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ssz-border-focus)"
              style={{ background: PRACTICE_ACCENT }}
            >
              {t('set.start', { n: questions })}
            </button>
          </>
        ) : (
          <ServerSolver
            exerciseId={exerciseId}
            language={data.targetLanguage}
            {...(instr(data) === undefined ? {} : { instruction: instr(data) })}
            {...(onChecked === undefined ? {} : { onChecked })}
            {...(stacked === true ? { stacked: true } : {})}
          />
        )}
      </div>
    );
  }

  // The cast is the lookup, not the map: `templateCode` is whatever the server sent, and
  // a code with no runner is the empty state below rather than a crash.
  const Solver = (
    SOLVERS as Record<string, ((props: SolverProps) => React.ReactElement) | undefined>
  )[data.templateCode];
  if (!Solver) {
    return (
      <div className="rounded-2xl border border-(--ssz-border-default) bg-surface px-6 py-12 text-center">
        <p className="text-sm text-(--ssz-text-muted)">
          {t('unsupported', { type: data.templateCode })}
        </p>
      </div>
    );
  }

  return (
    <div>
      {index != null && (
        <div className="mb-2 text-[12px] font-bold text-(--ssz-text-muted)">
          {t('taskNumber', { n: index })}
        </div>
      )}
      <Solver
        display={data}
        phase={phase}
        ok={graded?.ok ?? null}
        revealed={revealed}
        retryNonce={retryNonce}
        onCheck={(g) => {
          setGraded(g);
          setPhase('feedback');
          setAttempts((n) => n + 1);
          // A right answer explains itself; a wrong one waits to be asked.
          if (g.ok !== false) setRevealed(true);
          // Progress follows the first attempt — that is the honest signal.
          if (attempts === 0) onChecked?.(g.ok);
        }}
      />
      {phase === 'feedback' && graded && (
        <FeedbackBanner
          graded={graded}
          revealed={revealed}
          hint={primaryHintText(data.instructions) ?? undefined}
          onRetry={() => {
            setPhase('answering');
            setGraded(null);
            setRevealed(false);
            setRetryNonce((n) => n + 1);
          }}
          onToggleReveal={() => setRevealed((v) => !v)}
        />
      )}
    </div>
  );
}

export interface ExercisePageProps {
  exerciseId: string;
}

export function ExercisePage({ exerciseId }: ExercisePageProps) {
  return <ExerciseSolver exerciseId={exerciseId} />;
}

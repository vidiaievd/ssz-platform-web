'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';

import { useExerciseWithAnswers } from '@/features/content/api/use-exercise';
import { primaryInstructionText } from '@/features/content/lib/instruction-text';
import type { ExerciseWithAnswers } from '@/features/content/types';
import { ErrorState, LearningSkeleton } from '@/features/learning';
import {
  McqBody,
  FillBody,
  MatchBody,
  TranslateBody,
  ShortAnswerBody,
  WritingBody,
  SentenceSchemaBody,
  WordBankFillBody,
  checkWordBankFill,
  TextOrderBody,
  checkTextOrder,
  shuffleOrder,
  ErrorCorrectionBody,
  checkErrorCorrection,
  gradeMcq,
  gradeMatch,
  gradeTranslate,
  gradeShortAnswer,
  gradeSentenceSchema,
  normAnswer,
  PRACTICE_ACCENT,
  type McqContent,
  type FillRationale,
  type MatchContent,
  type MatchPair,
  type SchemaField,
  type SchemaToken,
  type SchemaPlacements,
  type WritingValue,
  type WordBankFillExpectedAnswers,
  type WordBankFillResults,
  type WordBankFillValue,
  type WordBankSentence,
  type OrderLine,
  type TextOrderResults,
  type ErrorCorrectionExpected,
  type ErrorCorrectionResults,
  type ErrorCorrectionValue,
  type ErrorSentence,
} from '@/features/student/exercises/runner';

/* ── types ──────────────────────────────────────────────────────────────── */

/** Grading outcome: true = correct, false = wrong, null = routed for review. */
type Ok = boolean | null;

interface Graded {
  ok: Ok;
  /** Explanation/summary revealed in the feedback banner. */
  explanation?: string;
  /** A reference/sample answer to show when relevant. */
  reference?: string;
}

interface SolverProps {
  display: ExerciseWithAnswers;
  phase: 'answering' | 'feedback';
  ok: Ok;
  onCheck: (graded: Graded) => void;
}

const ACCENT = PRACTICE_ACCENT;

/* ── helpers ────────────────────────────────────────────────────────────── */

const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const strArr = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
const instr = (d: ExerciseWithAnswers): string | undefined =>
  primaryInstructionText(d.instructions) ?? undefined;

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

function McqSolver({ display, phase, ok, onCheck }: SolverProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const c = display.content;
  const options = useMemo(
    () =>
      (Array.isArray(c.options) ? c.options : [])
        .filter((o): o is { id: string; text: string } => typeof (o as { id?: unknown }).id === 'string')
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

function FillSolver({ display, phase, ok, onCheck }: SolverProps) {
  const [value, setValue] = useState('');
  const c = display.content;
  const rawBlanks = Array.isArray(display.expectedAnswers.blanks) ? display.expectedAnswers.blanks : [];
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
        }}
        value={value}
        onValueChange={setValue}
        onAnswerChange={() => {}}
        phase={phase}
        ok={ok}
        mode="practice"
        accent={ACCENT}
        rationale={firstBlank?.rationale}
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

function MatchSolver({ display, phase, ok, onCheck }: SolverProps) {
  const [links, setLinks] = useState<Record<string, string>>({});
  const c = display.content;

  const pairs: MatchPair[] = useMemo(() => {
    const leftById = new Map(
      (Array.isArray(c.left_items) ? c.left_items : []).map((l) => [
        str((l as { id?: unknown }).id),
        str((l as { text?: unknown }).text),
      ]),
    );
    const rightById = new Map(
      (Array.isArray(c.right_items) ? c.right_items : []).map((r) => [
        str((r as { id?: unknown }).id),
        str((r as { text?: unknown }).text),
      ]),
    );
    const answerPairs = Array.isArray(display.expectedAnswers.pairs) ? display.expectedAnswers.pairs : [];
    return answerPairs.map((p) => {
      const leftId = str((p as { left_id?: unknown }).left_id);
      const rightId = str((p as { right_id?: unknown }).right_id);
      return { id: leftId, left: leftById.get(leftId) ?? '', right: rightById.get(rightId) ?? '' };
    });
  }, [c.left_items, c.right_items, display.expectedAnswers.pairs]);

  const content: MatchContent = {
    pairs,
    variant: c.variant === 'halves' ? 'halves' : 'pairs',
    instruction: instr(display),
  };
  const allLinked = pairs.every((p) => links[p.id]);

  return (
    <>
      <MatchBody
        content={content}
        links={links}
        onLinksChange={setLinks}
        onAnswerChange={() => {}}
        phase={phase}
        ok={ok}
        mode="practice"
        accent={ACCENT}
      />
      {phase === 'answering' && (
        <CheckFooter canSubmit={allLinked} onCheck={() => onCheck({ ok: gradeMatch(pairs, links) })} />
      )}
    </>
  );
}

function TranslateSolver({ display, phase, ok, onCheck }: SolverProps) {
  const [value, setValue] = useState('');
  const c = display.content;
  const accepted = strArr(display.expectedAnswers.accepted_translations);

  return (
    <>
      <TranslateBody
        content={{
          direction: display.templateCode === 'translate_from_target' ? 'from' : 'to',
          fromLabel: str(c.from_label),
          toLabel: str(c.to_label),
          sourceText: str(c.source_text),
          sampleAnswer: accepted[0] ?? '',
          instruction: instr(display),
        }}
        value={value}
        onValueChange={setValue}
        onAnswerChange={() => {}}
        phase={phase}
        ok={ok}
        mode="practice"
        accent={ACCENT}
      />
      {phase === 'answering' && (
        <CheckFooter
          canSubmit={value.trim() !== ''}
          onCheck={() => onCheck({ ok: gradeTranslate({ accepted_answers: accepted }, value), reference: accepted[0] })}
        />
      )}
    </>
  );
}

function ShortAnswerSolver({ display, phase, ok, onCheck }: SolverProps) {
  const [value, setValue] = useState('');
  const c = display.content;
  const ea = display.expectedAnswers;
  const reference = str(ea.reference_answer);

  return (
    <>
      <ShortAnswerBody
        content={{ question: str(c.question), context: str(c.context) || undefined, instruction: instr(display) }}
        value={value}
        onValueChange={setValue}
        onAnswerChange={() => {}}
        phase={phase}
        ok={ok}
        mode="practice"
        accent={ACCENT}
        referenceAnswer={reference || undefined}
      />
      {phase === 'answering' && (
        <CheckFooter
          canSubmit={value.trim() !== ''}
          onCheck={() =>
            onCheck({
              ok: gradeShortAnswer({ reference_answer: reference, accepted_answers: strArr(ea.accepted_answers) }, value),
              reference: reference || undefined,
            })
          }
        />
      )}
    </>
  );
}

function WritingSolver({ display, phase, ok, onCheck }: SolverProps) {
  const [value, setValue] = useState<WritingValue>({ text: '', topicId: null });
  const c = display.content;
  const topics = (Array.isArray(c.options) ? c.options : [])
    .filter((o): o is { id: string; title: string } => typeof (o as { id?: unknown }).id === 'string')
    .map((o) => ({ id: o.id, title: str(o.title) }));
  const minWords = typeof c.min_words === 'number' ? c.min_words : undefined;
  const [canSubmit, setCanSubmit] = useState(false);

  return (
    <>
      <WritingBody
        content={{ prompt: str(c.prompt), topics: topics.length > 0 ? topics : undefined, minWords, instruction: instr(display) }}
        value={value}
        onValueChange={setValue}
        onAnswerChange={setCanSubmit}
        phase={phase}
        ok={ok}
        mode="practice"
        accent={ACCENT}
      />
      {phase === 'answering' && (
        // Writing is always routed for review — no client-side correctness.
        <CheckFooter canSubmit={canSubmit} onCheck={() => onCheck({ ok: null })} />
      )}
    </>
  );
}

function SentenceSchemaSolver({ display, phase, ok, onCheck }: SolverProps) {
  const [value, setValue] = useState<SchemaPlacements>({});
  const c = display.content;
  const fields: SchemaField[] = (Array.isArray(c.fields) ? c.fields : [])
    .filter((f): f is { id: string; label: string } => typeof (f as { id?: unknown }).id === 'string')
    .map((f) => ({ id: f.id, label: str(f.label) }));
  const tokens: SchemaToken[] = (Array.isArray(c.tokens) ? c.tokens : [])
    .filter((tk): tk is { id: string; text: string } => typeof (tk as { id?: unknown }).id === 'string')
    .map((tk) => ({ id: tk.id, text: str(tk.text) }));
  const placements = (Array.isArray(display.expectedAnswers.placements) ? display.expectedAnswers.placements : []).map(
    (p) => ({ field_id: str((p as { field_id?: unknown }).field_id), token_ids: strArr((p as { token_ids?: unknown }).token_ids) }),
  );
  const [canSubmit, setCanSubmit] = useState(false);

  return (
    <>
      <SentenceSchemaBody
        content={{
          sentence: str(c.sentence),
          schema_type: c.schema_type === 'subordinate' ? 'subordinate' : 'main',
          fields,
          tokens,
          instruction: instr(display),
        }}
        value={value}
        onValueChange={setValue}
        onAnswerChange={setCanSubmit}
        phase={phase}
        ok={ok}
        mode="practice"
        accent={ACCENT}
      />
      {phase === 'answering' && (
        <CheckFooter canSubmit={canSubmit} onCheck={() => onCheck({ ok: gradeSentenceSchema({ placements }, value) })} />
      )}
    </>
  );
}

function WordBankFillSolver({ display, phase, ok, onCheck }: SolverProps) {
  const [value, setValue] = useState<WordBankFillValue>({});
  const [results, setResults] = useState<WordBankFillResults>({});
  const [canSubmit, setCanSubmit] = useState(false);
  const t = useTranslations('ExerciseRunner');
  const c = display.content;

  const wordBank = strArr(c.word_bank);
  const items: WordBankSentence[] = (Array.isArray(c.items) ? c.items : [])
    .filter((it): it is { id: string; text_with_blanks: string } => typeof (it as { id?: unknown }).id === 'string')
    .map((it) => ({ id: it.id, textWithBlanks: str(it.text_with_blanks) }));

  const expected: WordBankFillExpectedAnswers = {
    items: (Array.isArray(display.expectedAnswers.items) ? display.expectedAnswers.items : [])
      .filter((it): it is { id: string; blanks: unknown } => typeof (it as { id?: unknown }).id === 'string')
      .map((it) => ({
        id: it.id,
        blanks: (Array.isArray(it.blanks) ? it.blanks : [])
          .filter((b): b is { blank_id: number; accepted_answers: unknown } =>
            typeof (b as { blank_id?: unknown }).blank_id === 'number',
          )
          .map((b) => ({ blank_id: b.blank_id, accepted_answers: strArr(b.accepted_answers) })),
      })),
  };

  return (
    <>
      <WordBankFillBody
        content={{ wordBank, items, instruction: instr(display) }}
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
            const graded = checkWordBankFill(expected, value);
            setResults(graded.results);
            onCheck({
              ok: graded.ok,
              explanation: graded.ok
                ? str(display.expectedAnswers.explanation) || undefined
                : t('wordBank.partialScore', { correct: graded.correct, total: graded.total }),
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
        .filter((it): it is { id: string; text: string; speaker?: string } =>
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
              explanation: graded.ok
                ? str(display.expectedAnswers.explanation) || undefined
                : t('textOrder.partialScore', { correct: graded.correct, total: graded.total }),
            });
          }}
        />
      )}
    </>
  );
}


function ErrorCorrectionSolver({ display, phase, ok, onCheck }: SolverProps) {
  const t = useTranslations('ExerciseRunner');
  const [value, setValue] = useState<ErrorCorrectionValue>({});
  const [results, setResults] = useState<ErrorCorrectionResults>({});
  const [canSubmit, setCanSubmit] = useState(false);
  const c = display.content;

  const items: ErrorSentence[] = useMemo(
    () =>
      (Array.isArray(c.items) ? c.items : [])
        .filter((it): it is { id: string; chunks: unknown } => typeof (it as { id?: unknown }).id === 'string')
        .map((it) => ({
          id: it.id,
          chunks: (Array.isArray(it.chunks) ? it.chunks : [])
            .filter((ch): ch is { id: string; text: string } => typeof (ch as { id?: unknown }).id === 'string')
            .map((ch) => ({ id: ch.id, text: str(ch.text) })),
        })),
    [c.items],
  );

  const expected: ErrorCorrectionExpected = {
    corrections: (Array.isArray(display.expectedAnswers.corrections)
      ? display.expectedAnswers.corrections
      : []
    )
      .filter((cor): cor is { item_id: string; chunk_id: string; accepted: unknown; note?: string } =>
        typeof (cor as { chunk_id?: unknown }).chunk_id === 'string',
      )
      .map((cor) => ({
        item_id: str(cor.item_id),
        chunk_id: cor.chunk_id,
        accepted: strArr(cor.accepted),
        ...(str(cor.note) && { note: str(cor.note) }),
      })),
  };

  return (
    <>
      <ErrorCorrectionBody
        content={{
          items,
          mistakeCount:
            typeof c.mistake_count === 'number' ? c.mistake_count : expected.corrections.length,
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
            const graded = checkErrorCorrection(expected, value);
            setResults(graded.results);
            const tally = t('errorCorrection.partialScore', {
              correct: graded.correct,
              total: graded.total,
            });
            onCheck({
              ok: graded.ok,
              explanation: graded.ok
                ? str(display.expectedAnswers.explanation) || undefined
                : graded.falsePositives > 0
                  ? `${tally} · ${t('errorCorrection.falsePositives', { n: graded.falsePositives })}`
                  : tally,
            });
          }}
        />
      )}
    </>
  );
}

/* ── feedback banner ────────────────────────────────────────────────────── */

function FeedbackBanner({ graded }: { graded: Graded }) {
  const t = useTranslations('ExerciseRunner');
  const { ok, explanation, reference } = graded;
  const tone =
    ok === true
      ? { bg: 'var(--ssz-color-success-50)', line: 'var(--ssz-color-success-500)', fg: 'var(--ssz-color-success-700)', label: t('feedback.correct') }
      : ok === false
        ? { bg: 'var(--ssz-color-error-50)', line: 'var(--ssz-color-error-500)', fg: 'var(--ssz-color-error-700)', label: t('feedback.incorrect') }
        : { bg: 'var(--ssz-color-secondary-100)', line: 'var(--ssz-color-secondary-600)', fg: 'var(--ssz-color-secondary-700)', label: t('feedback.submitted') };

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
      {explanation && (
        <p className="mt-1.5 text-[13.5px]" style={{ color: 'var(--ssz-text-secondary)' }}>
          {explanation}
        </p>
      )}
      {ok === false && reference && (
        <p className="mt-1.5 text-[13.5px]" style={{ color: 'var(--ssz-text-secondary)' }}>
          {t('feedback.answerLabel')} <span className="font-semibold">{reference}</span>
        </p>
      )}
    </div>
  );
}

/* ── public component ───────────────────────────────────────────────────── */

const SOLVERS: Record<string, (props: SolverProps) => React.ReactElement> = {
  multiple_choice: McqSolver,
  fill_in_blank: FillSolver,
  match_pairs: MatchSolver,
  translate_to_target: TranslateSolver,
  translate_from_target: TranslateSolver,
  short_answer: ShortAnswerSolver,
  writing_task: WritingSolver,
  sentence_schema: SentenceSchemaSolver,
  word_bank_fill: WordBankFillSolver,
  text_order: TextOrderSolver,
  error_correction: ErrorCorrectionSolver,
};

export interface ExerciseSolverProps {
  exerciseId: string;
  /** 1-based position, shown when the exercise is one task of a practice set. */
  index?: number;
  /** Fired once, when the learner checks this exercise. */
  onChecked?: (ok: Ok) => void;
}

/**
 * One exercise: load → dispatch by template → grade client-side → feedback.
 * Used on its own (`ExercisePage`) and stacked by the practice page.
 */
export function ExerciseSolver({ exerciseId, index, onChecked }: ExerciseSolverProps) {
  const t = useTranslations('ExerciseRunner');
  const { data, isLoading, isError, refetch } = useExerciseWithAnswers(exerciseId);
  const [phase, setPhase] = useState<'answering' | 'feedback'>('answering');
  const [graded, setGraded] = useState<Graded | null>(null);

  // Per-item state is reset by remounting: the reader passes key={exerciseId}.

  if (isLoading) return <LearningSkeleton variant="list" rows={4} />;
  if (isError || !data) return <ErrorState onRetry={() => refetch()} />;

  const Solver = SOLVERS[data.templateCode];
  if (!Solver) {
    return (
      <div className="rounded-2xl border border-(--ssz-border-default) bg-surface px-6 py-12 text-center">
        <p className="text-sm text-(--ssz-text-muted)">{t('unsupported', { type: data.templateCode })}</p>
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
        onCheck={(g) => {
          setGraded(g);
          setPhase('feedback');
          onChecked?.(g.ok);
        }}
      />
      {phase === 'feedback' && graded && <FeedbackBanner graded={graded} />}
    </div>
  );
}

export interface ExercisePageProps {
  exerciseId: string;
}

export function ExercisePage({ exerciseId }: ExercisePageProps) {
  return <ExerciseSolver exerciseId={exerciseId} />;
}

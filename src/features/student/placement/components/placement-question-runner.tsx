'use client';

import { useCallback } from 'react';
import { ArrowRight } from 'lucide-react';
import { useTranslations } from 'next-intl';

import type { ExerciseDisplay } from '@/features/content/types';
import { primaryInstructionText } from '@/features/content/lib/instruction-text';
import { McqBody, gradeMcq, gradeFreeText } from '@/features/student/exercises/runner';
import type { McqContent, McqExpectedAnswers } from '@/features/student/exercises/runner';
import type { FreeTextExpectedAnswers } from '@/features/student/exercises/runner';
import { FreeTextBody, type FreeTextContent } from './free-text-body';
import { PLACEMENT_QUESTION_COUNT } from '../adaptive';
import { usePlacementStore } from '../stores/placement-store';
import { PlacementProgressRow } from './placement-progress-row';

/* ── design tokens ──────────────────────────────────────────────────────────── */
const PRIMARY = 'var(--ssz-color-primary-500)';
const READING = 'var(--ssz-font-reading)';

/* ── content parsing ────────────────────────────────────────────────────────── */

interface ParsedMcq {
  content: McqContent;
  expected: McqExpectedAnswers;
}

function parseMcq(display: ExerciseDisplay): ParsedMcq | null {
  const c = display.content;
  const question = typeof c.question === 'string' ? c.question : null;
  const rawOpts = Array.isArray(c.options) ? c.options : null;
  if (!question || !rawOpts) return null;

  const options = rawOpts.filter(
    (o): o is { id: string; text: string } =>
      typeof (o as Record<string, unknown>).id === 'string' &&
      typeof (o as Record<string, unknown>).text === 'string',
  );
  if (options.length === 0) return null;

  const ea = (c.expected_answers as Record<string, unknown> | undefined) ?? c;
  const correctIds = Array.isArray(ea.correct_option_ids) ? (ea.correct_option_ids as string[]) : [];

  return {
    content: {
      question,
      options,
      instruction: primaryInstructionText(display.instructions) ?? undefined,
    },
    expected: { correct_option_ids: correctIds },
  };
}

interface ParsedFreeText {
  content: FreeTextContent;
  expected: FreeTextExpectedAnswers;
}

function parseFreeText(display: ExerciseDisplay): ParsedFreeText | null {
  const c = display.content;
  const sourceText = typeof c.source_text === 'string' ? c.source_text : null;
  if (!sourceText) return null;

  const fromLabel = typeof c.from_label === 'string' ? c.from_label : 'English';
  const toLabel   = typeof c.to_label   === 'string' ? c.to_label   : 'Norwegian';
  const sampleAnswer = typeof c.sample_answer === 'string' ? c.sample_answer : '';

  const ea = (c.expected_answers as Record<string, unknown> | undefined) ?? c;
  const rawAccepted = Array.isArray(ea.accepted_answers) ? (ea.accepted_answers as string[]) : [];

  return {
    content: {
      direction: 'to',
      fromLabel,
      toLabel,
      sourceText,
      sampleAnswer,
      instruction: primaryInstructionText(display.instructions) ?? undefined,
    },
    expected: { accepted_answers: rawAccepted },
  };
}

/* ── MCQ body wrapper for placement ────────────────────────────────────────── */

interface PlacementMcqProps {
  display: ExerciseDisplay;
  selectedOption: string | null;
  onSelect: (id: string) => void;
  onGrade: (correct: boolean) => void;
  onDontKnow: () => void;
  isLast: boolean;
}

function PlacementMcqQuestion({
  display,
  selectedOption,
  onSelect,
  onGrade,
  onDontKnow,
  isLast,
}: PlacementMcqProps) {
  const t = useTranslations('Placement');
  const mcq = parseMcq(display);
  const noop = useCallback(() => {}, []);

  if (!mcq) return null;

  const canSubmit = selectedOption !== null;

  function handleContinue() {
    if (!canSubmit) return;
    onGrade(gradeMcq(mcq!.expected, selectedOption));
  }

  return (
    <>
      {/* Eyebrow */}
      <p
        className="mb-[14px] text-[11px] font-bold uppercase"
        style={{ letterSpacing: '0.07em', color: 'var(--ssz-text-muted)' }}
      >
        {t('runner.mcqEyebrow')}
      </p>

      {/* Prompt in reading font (B10 spec) */}
      <h2
        className="mb-[6px] font-semibold leading-[1.35]"
        style={{ fontFamily: READING, fontSize: 24, color: 'var(--ssz-text-primary)' }}
      >
        {mcq.content.question}
      </h2>

      {/* Optional English gloss */}
      {primaryInstructionText(display.instructions) && (
        <p
          className="mb-[18px] italic"
          style={{ fontSize: 15, color: 'var(--ssz-text-secondary)' }}
        >
          {primaryInstructionText(display.instructions)}
        </p>
      )}

      {/* MCQ options — always in answering phase; no feedback reveal */}
      <McqBody
        content={{ question: '', options: mcq.content.options }}
        expectedAnswers={mcq.expected}
        selectedId={selectedOption}
        onSelect={onSelect}
        onAnswerChange={noop}
        phase="answering"
        ok={null}
        mode="practice"
        accent={PRIMARY}
      />

      <PlacementFooter
        canSubmit={canSubmit}
        isLast={isLast}
        onContinue={handleContinue}
        onDontKnow={onDontKnow}
      />
    </>
  );
}

/* ── Free-text body wrapper for placement ───────────────────────────────────── */

interface PlacementFreeTextProps {
  display: ExerciseDisplay;
  value: string;
  onValueChange: (v: string) => void;
  onGrade: (correct: boolean) => void;
  onDontKnow: () => void;
  isLast: boolean;
}

function PlacementFreeTextQuestion({
  display,
  value,
  onValueChange,
  onGrade,
  onDontKnow,
  isLast,
}: PlacementFreeTextProps) {
  const t = useTranslations('Placement');
  const parsed = parseFreeText(display);
  const noop = useCallback(() => {}, []);

  if (!parsed) return null;

  const canSubmit = value.trim() !== '';

  function handleContinue() {
    if (!canSubmit) return;
    onGrade(gradeFreeText(parsed!.expected, value));
  }

  return (
    <>
      {/* Eyebrow */}
      <p
        className="mb-[14px] text-[11px] font-bold uppercase"
        style={{ letterSpacing: '0.07em', color: 'var(--ssz-text-muted)' }}
      >
        {t('runner.translateEyebrow', { lang: parsed.content.toLabel })}
      </p>

      {/* Source card */}
      <div
        className="mb-[18px]"
        style={{
          background: 'var(--ssz-bg-surface)',
          borderRadius: 14,
          padding: '16px 20px',
          border: '1.5px solid var(--ssz-border-default)',
        }}
      >
        <div
          className="mb-1.5 text-[11px] font-bold uppercase"
          style={{ letterSpacing: '0.04em', color: 'var(--ssz-text-muted)' }}
        >
          {parsed.content.fromLabel}
        </div>
        <p
          className="font-semibold"
          style={{ fontFamily: READING, fontSize: 22, color: 'var(--ssz-text-primary)' }}
        >
          {parsed.content.sourceText}
        </p>
      </div>

      {/* Answer textarea — always in answering phase */}
      <FreeTextBody
        content={parsed.content}
        value={value}
        onValueChange={onValueChange}
        onAnswerChange={noop}
        phase="answering"
        ok={null}
        mode="practice"
        accent={PRIMARY}
      />

      <PlacementFooter
        canSubmit={canSubmit}
        isLast={isLast}
        onContinue={handleContinue}
        onDontKnow={onDontKnow}
      />
    </>
  );
}

/* ── Footer ─────────────────────────────────────────────────────────────────── */

interface PlacementFooterProps {
  canSubmit: boolean;
  isLast: boolean;
  onContinue: () => void;
  onDontKnow: () => void;
}

function PlacementFooter({ canSubmit, isLast, onContinue, onDontKnow }: PlacementFooterProps) {
  const t = useTranslations('Placement.runner');

  return (
    <div
      className="mt-[22px] flex items-center justify-between border-t pt-[18px]"
      style={{ borderColor: 'var(--ssz-border-default)' }}
    >
      <button
        type="button"
        onClick={onDontKnow}
        className="text-[14px] font-medium hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ssz-border-focus)]"
        style={{ color: 'var(--ssz-text-secondary)', padding: '10px 4px' }}
      >
        {t('dontKnow')}
      </button>

      <button
        type="button"
        disabled={!canSubmit}
        onClick={onContinue}
        className="inline-flex items-center gap-[6px] rounded-xl px-6 py-[11px] text-[15px] font-bold text-white transition-colors disabled:pointer-events-none disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ssz-border-focus)]"
        style={{
          background: canSubmit ? PRIMARY : PRIMARY,
          boxShadow: canSubmit ? 'var(--ssz-shadow-sm)' : 'none',
        }}
      >
        {isLast ? t('seeMyLevel') : t('continue')}
        <ArrowRight size={15} aria-hidden="true" />
      </button>
    </div>
  );
}

/* ── public component ────────────────────────────────────────────────────────── */

export interface PlacementQuestionRunnerProps {
  /** Called from the full-screen shell when the header "Skip for now" is pressed. */
  onSkipForNow?: () => void;
}

export function PlacementQuestionRunner({ onSkipForNow }: PlacementQuestionRunnerProps) {
  const questionNumber  = usePlacementStore((s) => s.questionNumber);
  const activeLevelIdx  = usePlacementStore((s) => s.levelIndex);
  const lastDirection   = usePlacementStore((s) => s.lastDirection);
  const currentQuestion = usePlacementStore((s) => s.currentQuestion);
  const selectedOption  = usePlacementStore((s) => s.selectedOption);
  const translationText = usePlacementStore((s) => s.translationText);
  const selectOption    = usePlacementStore((s) => s.selectOption);
  const setTranslation  = usePlacementStore((s) => s.setTranslationText);
  const submitAnswer    = usePlacementStore((s) => s.submitAnswer);
  const skipTest        = usePlacementStore((s) => s.skipTest);

  if (!currentQuestion) return null;

  const isLast = questionNumber === PLACEMENT_QUESTION_COUNT - 1;
  const isMcq  = currentQuestion.templateCode === 'multiple_choice';

  function handleGrade(wasCorrect: boolean) {
    submitAnswer(wasCorrect);
  }

  function handleDontKnow() {
    submitAnswer(false);
  }

  const onSkip = onSkipForNow ?? skipTest;

  return (
    <div className="flex w-full flex-col gap-[22px]" style={{ maxWidth: 520 }}>
      {/* "Skip for now" link — shown here for inline presentation; fullscreen shell
          renders it in the header slot and passes onSkipForNow. */}
      {!onSkipForNow && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onSkip}
            className="text-[13px] font-medium hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ssz-border-focus)]"
            style={{ color: 'var(--ssz-text-muted)' }}
          >
          </button>
        </div>
      )}

      <PlacementProgressRow
        questionNumber={questionNumber}
        activeLevelIndex={activeLevelIdx}
        lastDirection={lastDirection}
      />

      <div>
        {isMcq ? (
          <PlacementMcqQuestion
            display={currentQuestion}
            selectedOption={selectedOption}
            onSelect={selectOption}
            onGrade={handleGrade}
            onDontKnow={handleDontKnow}
            isLast={isLast}
          />
        ) : (
          <PlacementFreeTextQuestion
            display={currentQuestion}
            value={translationText}
            onValueChange={setTranslation}
            onGrade={handleGrade}
            onDontKnow={handleDontKnow}
            isLast={isLast}
          />
        )}
      </div>
    </div>
  );
}

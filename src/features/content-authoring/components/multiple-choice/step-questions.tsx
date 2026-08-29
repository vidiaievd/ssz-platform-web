'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { BookOpen, Check, ClipboardPaste, Copy, Plus, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  answerableQuestions,
  correctOption,
  KINDS,
  kindConfig,
  type Question,
  type QuestionKind,
} from '@/lib/shared-kernel/multiple-choice';

import {
  addOption,
  addQuestion,
  applyBulkPaste,
  duplicateQuestion,
  markKey,
  MAX_OPTIONS,
  MIN_OPTIONS,
  removeOption,
  removeQuestion,
  setKind,
  setOption,
  setQuestion,
  type MultipleChoiceDocument,
} from './edits';

/** The badges the builder and the runner both letter options with. */
const LETTERS = 'ABCDEFGH';

export interface StepQuestionsProps {
  exercise: MultipleChoiceDocument;
  onChange: (next: MultipleChoiceDocument) => void;
}

/**
 * Step 1: the questions, their options, and which option is the answer.
 *
 * The only step that creates and destroys questions — steps 2 to 4 edit the fields of
 * questions that already exist (IMPLEMENTATION.md, "Steps last, in order 1 → 4"). Every
 * step writes to the same document; there are no per-step drafts and no apply buttons.
 *
 * Controlled and presentational: a document in, a document out. Everything derived — which
 * questions are finished, what is missing — comes from the kernel, so this screen and the
 * server's publish preflight cannot disagree about the same document.
 *
 * The bulk paste is not a convenience here, it is the step. Five questions with four
 * options each is thirty fields typed one at a time, and an author who has the questions
 * written down elsewhere should not be retyping them into a form.
 */
export function StepQuestions({ exercise, onChange }: StepQuestionsProps) {
  const t = useTranslations('Authoring');
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulk, setBulk] = useState('');

  const ready = answerableQuestions(exercise);
  const pastedCount = bulk.split('\n').filter((line) => line.trim() !== '').length;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-base font-semibold">{t('multipleChoice.step1.title')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t('multipleChoice.step1.lede')}</p>
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium" htmlFor="mc-title">
            {t('multipleChoice.step1.titleLabel')}
          </label>
          <Input
            id="mc-title"
            aria-describedby="mc-title-help"
            value={exercise.title}
            placeholder={t('multipleChoice.step1.titlePlaceholder')}
            onChange={(event) => onChange({ ...exercise, title: event.target.value })}
          />
          <p id="mc-title-help" className="text-xs text-muted-foreground">
            {t('multipleChoice.step1.titleHelp')}
          </p>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium" htmlFor="mc-instruction">
            {t('multipleChoice.step1.instructionLabel')}
          </label>
          <Input
            id="mc-instruction"
            aria-describedby="mc-instruction-help"
            value={exercise.instruction}
            placeholder={t('multipleChoice.step1.instructionPlaceholder')}
            onChange={(event) => onChange({ ...exercise, instruction: event.target.value })}
          />
          <p id="mc-instruction-help" className="text-xs text-muted-foreground">
            {t('multipleChoice.step1.instructionHelp')}
          </p>
        </div>
      </div>

      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-xs font-medium">
          {t('multipleChoice.step1.count', { count: exercise.questions.length })}
        </h3>
        {/*
          Finished, not written: a question the runner would skip is one the author is
          still in the middle of, and the difference between "four questions" and "two
          finished" is the only place that gap is visible before the gate.
        */}
        <p className="text-xs text-muted-foreground">
          {t('multipleChoice.step1.ready', { count: ready.length })}
        </p>
      </div>

      {exercise.questions.length === 0 && (
        <p className="text-xs text-error" role="status">
          {t('multipleChoice.issues.EX_NO_QUESTIONS')}
        </p>
      )}

      <ul className="flex flex-col gap-3">
        {exercise.questions.map((question, index) => (
          <li key={question.id}>
            <QuestionCard
              question={question}
              index={index}
              exercise={exercise}
              onChange={onChange}
            />
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="secondary"
          onClick={() => onChange(addQuestion(exercise))}
        >
          <Plus className="size-4" aria-hidden />
          {t('multipleChoice.step1.addQuestion')}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setBulkOpen(!bulkOpen)}>
          <ClipboardPaste className="size-4" aria-hidden />
          {t('multipleChoice.step1.bulkOpen')}
        </Button>
      </div>

      {/*
        A worksheet becomes a set in one paste. Appended rather than merged, as BEHAVIOR
        asks: a paste that quietly rewrote questions already on screen would be the one
        operation in this builder with no way back.
      */}
      {bulkOpen && (
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
          <p className="text-sm font-medium">{t('multipleChoice.step1.bulkTitle')}</p>
          <p className="text-xs text-muted-foreground">{t('multipleChoice.step1.bulkHelp')}</p>
          <Textarea
            rows={6}
            value={bulk}
            aria-label={t('multipleChoice.step1.bulkTitle')}
            placeholder={t('multipleChoice.step1.bulkPlaceholder')}
            onChange={(event) => setBulk(event.target.value)}
          />
          <p className="text-xs text-muted-foreground">{t('multipleChoice.step1.bulkNote')}</p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              disabled={bulk.trim() === ''}
              onClick={() => {
                onChange(applyBulkPaste(exercise, bulk));
                setBulk('');
                setBulkOpen(false);
              }}
            >
              {t('multipleChoice.step1.bulkApply', { count: pastedCount })}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setBulkOpen(false)}>
              {t('multipleChoice.step1.bulkCancel')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * One question: what it is about, what it asks, and which of its options is right.
 *
 * The card takes its red state while the stem or the key is missing — the two step-1
 * blockers an author can see from here — so the problem is visible where it is fixed
 * rather than only behind the `Done` button (the rule plan 50 set and every builder since
 * has followed).
 */
function QuestionCard({
  question,
  index,
  exercise,
  onChange,
}: {
  question: Question;
  index: number;
  exercise: MultipleChoiceDocument;
  onChange: (next: MultipleChoiceDocument) => void;
}) {
  const t = useTranslations('Authoring');

  const key = correctOption(question);
  const noStem = question.stem.trim() === '';
  const noKey = key === null || key.text.trim() === '';
  const config = kindConfig(question.kind);
  const hasContext = question.context.trim() !== '';
  /*
    The passage field is offered rather than always drawn, and once there is a passage it
    stays: BEHAVIOR §"Step 1" — "Once `context` is non-empty the field stays visible". The
    local flag only covers the case of an author who asked for it and has not typed yet.
  */
  const [contextOpen, setContextOpen] = useState(hasContext);
  const showContext = contextOpen || hasContext;

  return (
    <div
      className={`flex flex-col gap-3 rounded-lg border bg-surface p-4 ${
        noStem || noKey ? 'border-error' : 'border-border'
      }`}
    >
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className="grid size-5 shrink-0 place-items-center rounded-full bg-(--ssz-bg-muted) text-[11px] font-bold text-(--ssz-text-secondary)"
        >
          {index + 1}
        </span>

        <Select
          value={question.kind}
          onValueChange={(kind) => onChange(setKind(exercise, question.id, kind as QuestionKind))}
        >
          <SelectTrigger
            className="h-8 w-44"
            aria-label={t('multipleChoice.step1.kindLabel', { index: index + 1 })}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {KINDS.map((kind) => (
              <SelectItem key={kind.id} value={kind.id}>
                {t(`multipleChoice.kinds.${kind.id}` as 'multipleChoice.kinds.grammar')}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <span className="flex-1" />

        {/* The cheapest way to write the fifth question about one text: everything but the
            stem is already right. `edits.ts` mints new ids for the question and for every
            option, so the copy's key is its own. */}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={t('multipleChoice.step1.duplicate', { index: index + 1 })}
          onClick={() => onChange(duplicateQuestion(exercise, question.id))}
        >
          <Copy className="size-4" aria-hidden />
        </Button>
        {/* No confirmation, as BEHAVIOR asks: the deletion is undone by the builder's own
            revert, and a dialogue in front of every removed question charges the common
            case for the rare one. */}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={t('multipleChoice.step1.remove', { index: index + 1 })}
          onClick={() => onChange(removeQuestion(exercise, question.id))}
        >
          <Trash2 className="size-4" aria-hidden />
        </Button>
      </div>

      {showContext && (
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium" htmlFor={`mc-context-${question.id}`}>
            {t('multipleChoice.step1.passageLabel')}
          </label>
          <Textarea
            id={`mc-context-${question.id}`}
            aria-describedby={`mc-context-help-${question.id}`}
            value={question.context}
            rows={3}
            placeholder={t('multipleChoice.step1.passagePlaceholder')}
            onChange={(event) =>
              onChange(setQuestion(exercise, question.id, { context: event.target.value }))
            }
          />
          {/* A `listening` passage is the author's transcript and the projection never
              sends it (plan 53 §3.8) — so the help line has to say so, or an author will
              write it for the student to read. */}
          <p
            id={`mc-context-help-${question.id}`}
            className={`text-xs ${
              config.needsPassage && !hasContext ? 'text-warning-700' : 'text-muted-foreground'
            }`}
          >
            {config.needsPassage && !hasContext
              ? t('multipleChoice.issues.Q_NO_PASSAGE')
              : question.kind === 'listening'
                ? t('multipleChoice.step1.passageListeningHelp')
                : t('multipleChoice.step1.passageHelp')}
          </p>
        </div>
      )}

      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium" htmlFor={`mc-stem-${question.id}`}>
          {t('multipleChoice.step1.stemLabel')}
        </label>
        <Textarea
          id={`mc-stem-${question.id}`}
          aria-describedby={`mc-stem-help-${question.id}`}
          value={question.stem}
          rows={2}
          hasError={noStem}
          aria-invalid={noStem}
          placeholder={t('multipleChoice.step1.stemPlaceholder')}
          onChange={(event) =>
            onChange(setQuestion(exercise, question.id, { stem: event.target.value }))
          }
        />
        {/* The message sits next to the field rather than replacing its help line, because
            `aria-invalid` on its own says "wrong" and not what to do. */}
        <p
          id={`mc-stem-help-${question.id}`}
          className={`text-xs ${noStem ? 'text-error' : 'text-muted-foreground'}`}
        >
          {noStem ? t('multipleChoice.issues.Q_NO_STEM') : t('multipleChoice.step1.stemHelp')}
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium">{t('multipleChoice.step1.optionsLabel')}</span>
        {/*
          One radio group per question, not per row. The key controls are `role="radio"`
          as the handoff asks, and a lone radio outside a group is not a control any screen
          reader can describe — it is the group that says "one of these", which is the
          entire rule this widget enforces.
        */}
        <ul
          className="flex flex-col gap-1.5"
          role="radiogroup"
          aria-label={t('multipleChoice.step1.optionsLabel')}
        >
          {question.options.map((option, at) => {
            const letter = LETTERS[at] ?? String(at + 1);

            return (
              <li key={option.id} className="flex items-center gap-2">
                <span
                  aria-hidden
                  className={`grid size-7 shrink-0 place-items-center rounded-lg border font-mono text-[11px] font-bold ${
                    option.correct
                      ? 'border-success-500 bg-success-50 text-success-700'
                      : 'border-border bg-subtle text-(--ssz-text-secondary)'
                  }`}
                >
                  {letter}
                </span>
                <Input
                  className={option.correct ? 'border-success-500' : undefined}
                  aria-label={t('multipleChoice.step1.optionLabel', {
                    letter,
                    index: index + 1,
                  })}
                  value={option.text}
                  placeholder={
                    at === 0
                      ? t('multipleChoice.step1.optionPlaceholderKey')
                      : t('multipleChoice.step1.optionPlaceholderWrong')
                  }
                  onChange={(event) =>
                    onChange(
                      setOption(exercise, question.id, option.id, { text: event.target.value }),
                    )
                  }
                />
                <button
                  type="button"
                  role="radio"
                  aria-checked={option.correct}
                  aria-label={t('multipleChoice.step1.markKey', { letter })}
                  onClick={() => onChange(markKey(exercise, question.id, option.id))}
                  className={`grid size-7 shrink-0 place-items-center rounded-full border transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none ${
                    option.correct
                      ? 'border-success-500 bg-success-500 text-white'
                      : 'border-border text-transparent hover:border-success-500'
                  }`}
                >
                  <Check className="size-3.5" aria-hidden />
                </button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={question.options.length <= MIN_OPTIONS}
                  title={
                    question.options.length <= MIN_OPTIONS
                      ? t('multipleChoice.step1.removeOptionFloor')
                      : undefined
                  }
                  aria-label={t('multipleChoice.step1.removeOption', { letter })}
                  onClick={() => onChange(removeOption(exercise, question.id, option.id))}
                >
                  <Trash2 className="size-4" aria-hidden />
                </Button>
              </li>
            );
          })}
        </ul>
        <p className={`text-xs ${noKey ? 'text-error' : 'text-muted-foreground'}`}>
          {noKey ? t('multipleChoice.issues.Q_NO_KEY') : t('multipleChoice.step1.keyHelp')}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={question.options.length >= MAX_OPTIONS}
          title={
            question.options.length >= MAX_OPTIONS
              ? t('multipleChoice.step1.addOptionCeiling')
              : undefined
          }
          onClick={() => onChange(addOption(exercise, question.id))}
        >
          <Plus className="size-4" aria-hidden />
          {t('multipleChoice.step1.addOption')}
        </Button>
        {!showContext && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setContextOpen(true)}
          >
            <BookOpen className="size-4" aria-hidden />
            {t('multipleChoice.step1.addPassage')}
          </Button>
        )}
      </div>
    </div>
  );
}

'use client';

import { useTranslations } from 'next-intl';
import { Copy, Plus, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { withSegment } from '@/lib/shared-kernel/audio';
import {
  gradeableQuestions,
  KINDS,
  kindConfig,
  type Question,
  type QuestionKind,
} from '@/lib/shared-kernel/short-answer';

import { AudioEnableRow, AudioSegmentField, AudioSourceCard } from '../audio';
import {
  addQuestion,
  duplicateQuestion,
  removeQuestion,
  setKind,
  setQuestion,
  type ShortAnswerDocument,
} from './edits';

export interface StepQuestionsProps {
  exercise: ShortAnswerDocument;
  onChange: (next: ShortAnswerDocument) => void;
}

/**
 * Step 1: the questions, and the answer the author would accept for each.
 *
 * Controlled and presentational — a document in, a document out. Everything derived (which
 * questions are answerable, what is missing) comes from the kernel, so this screen and the
 * server never disagree about the same document.
 *
 * The model answer is a step-1 field, not a step-2 one, and that placement is the whole
 * shape of this builder. The key on step 2 is *derived from* the model answer and validated
 * against it, so asking for the answer after asking for the elements would have the author
 * inventing phrasings for a sentence they have not written yet.
 *
 * There is no title field on the platform's exercises; the header card's title is the
 * document's own, which the runner does not show — it names the set for the author.
 */
export function StepQuestions({ exercise, onChange }: StepQuestionsProps) {
  const t = useTranslations('Authoring');
  const ready = gradeableQuestions(exercise);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-base font-semibold">{t('shortAnswer.step1.title')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t('shortAnswer.step1.lede')}</p>
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium">{t('shortAnswer.step1.titleLabel')}</span>
          <Input
            value={exercise.title}
            placeholder={t('shortAnswer.step1.titlePlaceholder')}
            onChange={(event) => onChange({ ...exercise, title: event.target.value })}
          />
        </label>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium" htmlFor="sa-instruction">
            {t('shortAnswer.step1.instructionLabel')}
          </label>
          <Input
            id="sa-instruction"
            aria-describedby="sa-instruction-help"
            value={exercise.instruction}
            placeholder={t('shortAnswer.step1.instructionPlaceholder')}
            onChange={(event) => onChange({ ...exercise, instruction: event.target.value })}
          />
          <p id="sa-instruction-help" className="text-xs text-muted-foreground">
            {t('shortAnswer.step1.instructionHelp')}
          </p>
        </div>

        {/* Audio adds no wizard step: it is material, and material lives where the title
            and the instruction live (plan 56, README "Authoring UI"). */}
        <AudioEnableRow
          draft={exercise.audio}
          onChange={(audio) => onChange({ ...exercise, audio })}
        />
      </div>

      {exercise.audio.audio.enabled && (
        <AudioSourceCard
          draft={exercise.audio}
          onChange={(audio) => onChange({ ...exercise, audio })}
        />
      )}

      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-xs font-medium">
          {t('shortAnswer.step1.count', { count: exercise.questions.length })}
        </h3>
        {/*
          Answerable, not written: a question the runner would skip is one the author is
          still in the middle of, and the difference between "four questions" and "two ready
          to answer" is the only place that gap is visible before the gate.
        */}
        <p className="text-xs text-muted-foreground">
          {t('shortAnswer.step1.ready', { count: ready.length })}
        </p>
      </div>

      {exercise.questions.length === 0 && (
        <p className="text-xs text-error" role="status">
          {t('shortAnswer.issues.EX_NO_QUESTIONS')}
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

      <div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onChange(addQuestion(exercise))}
        >
          <Plus className="size-4" aria-hidden />
          {t('shortAnswer.step1.addQuestion')}
        </Button>
      </div>
    </div>
  );
}

/**
 * One question: what it is about, what it asks, and the answer the author would accept.
 *
 * The card takes its red state while the prompt or the model answer is missing — the two
 * step-1 blockers — so the problem is visible where it is fixed rather than only behind the
 * `Done` button. A blocker that can only be found by pressing `Done` is a blocker found
 * late (plan 51, phase 5).
 */
function QuestionCard({
  question,
  index,
  exercise,
  onChange,
}: {
  question: Question;
  index: number;
  exercise: ShortAnswerDocument;
  onChange: (next: ShortAnswerDocument) => void;
}) {
  const t = useTranslations('Authoring');

  const noPrompt = question.prompt.trim() === '';
  // Only once there is a question to answer. Two red fields on a card nobody has started
  // writing say nothing the one red field does not.
  const noModel = !noPrompt && question.model.trim() === '';
  const config = kindConfig(question.kind);
  const noPassage = config.needsPassage && question.passage.trim() === '';
  const timecodes = exercise.audio.audio.enabled && exercise.audio.audio.useSegments;

  const update = (patch: Parameters<typeof setQuestion>[2]) =>
    onChange(setQuestion(exercise, question.id, patch));

  return (
    <div
      className={`flex flex-col gap-3 rounded-lg border bg-surface p-4 ${
        noPrompt || noModel ? 'border-error' : 'border-border'
      }`}
    >
      {/* A question of its own line in the clip — the case this type is written for: five
          questions about one dialogue, each answered from a different half-minute of it. */}
      {timecodes && (
        <AudioSegmentField
          segment={exercise.audio.segments[question.id] ?? null}
          onChange={(segment) =>
            onChange({ ...exercise, audio: withSegment(exercise.audio, question.id, segment) })
          }
        />
      )}
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
            aria-label={t('shortAnswer.step1.kindLabel', { index: index + 1 })}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {KINDS.map((kind) => (
              <SelectItem key={kind.id} value={kind.id}>
                {t(`shortAnswer.kinds.${kind.id}` as 'shortAnswer.kinds.reading')}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <span className="flex-1" />

        {/* A duplicate is the cheapest way to write the fifth question about one text:
            everything but the prompt is already right. `edits.ts` mints new ids for the
            question and for every element, so the copy's key is its own. */}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={t('shortAnswer.step1.duplicate', { index: index + 1 })}
          onClick={() => onChange(duplicateQuestion(exercise, question.id))}
        >
          <Copy className="size-4" aria-hidden />
        </Button>
        {/* No confirmation, as the handoff asks (BEHAVIOR §"Step 1"): the deletion is
            undone by the builder's own revert, and a dialog in front of every removed
            question would charge the common case for the rare one. */}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={t('shortAnswer.step1.remove', { index: index + 1 })}
          onClick={() => onChange(removeQuestion(exercise, question.id))}
        >
          <Trash2 className="size-4" aria-hidden />
        </Button>
      </div>

      {/*
        `opinion` has no passage field at all — there is no text the question is about. A
        passage written before the kind was changed stays in the document (`edits.ts`) and
        simply stops being shown; the projection reads `kind`, so nothing can leak from it.
      */}
      {question.kind !== 'opinion' && (
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium" htmlFor={`sa-passage-${question.id}`}>
            {question.kind === 'listening'
              ? t('shortAnswer.step1.passageListening')
              : t('shortAnswer.step1.passageReading')}
          </label>
          <Textarea
            id={`sa-passage-${question.id}`}
            aria-describedby={`sa-passage-help-${question.id}`}
            value={question.passage}
            rows={4}
            placeholder={t('shortAnswer.step1.passagePlaceholder')}
            onChange={(event) => update({ passage: event.target.value })}
          />
          <p
            id={`sa-passage-help-${question.id}`}
            className={`text-xs ${noPassage ? 'text-warning-700' : 'text-muted-foreground'}`}
          >
            {noPassage
              ? t('shortAnswer.issues.Q_NO_PASSAGE_ANY')
              : question.kind === 'listening'
                ? t('shortAnswer.step1.passageListeningHelp')
                : t('shortAnswer.step1.passageReadingHelp')}
          </p>
        </div>
      )}

      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium" htmlFor={`sa-prompt-${question.id}`}>
          {t('shortAnswer.step1.promptLabel')}
        </label>
        <Textarea
          id={`sa-prompt-${question.id}`}
          aria-describedby={`sa-prompt-help-${question.id}`}
          value={question.prompt}
          rows={2}
          hasError={noPrompt}
          aria-invalid={noPrompt}
          placeholder={t('shortAnswer.step1.promptPlaceholder')}
          onChange={(event) => update({ prompt: event.target.value })}
        />
        {/* The message sits next to the field rather than replacing its help line, because
            `aria-invalid` on its own says "wrong" and not what to do. */}
        <p
          id={`sa-prompt-help-${question.id}`}
          className={`text-xs ${noPrompt ? 'text-error' : 'text-muted-foreground'}`}
        >
          {noPrompt ? t('shortAnswer.issues.Q_NO_PROMPT_ANY') : t('shortAnswer.step1.promptHelp')}
        </p>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium" htmlFor={`sa-model-${question.id}`}>
          {t('shortAnswer.step1.modelLabel')}
        </label>
        <Textarea
          id={`sa-model-${question.id}`}
          aria-describedby={`sa-model-help-${question.id}`}
          value={question.model}
          rows={2}
          hasError={noModel}
          aria-invalid={noModel}
          placeholder={t('shortAnswer.step1.modelPlaceholder')}
          onChange={(event) => update({ model: event.target.value })}
        />
        <p
          id={`sa-model-help-${question.id}`}
          className={`text-xs ${noModel ? 'text-error' : 'text-muted-foreground'}`}
        >
          {noModel ? t('shortAnswer.issues.Q_NO_MODEL_ANY') : t('shortAnswer.step1.modelHelp')}
        </p>
      </div>
    </div>
  );
}

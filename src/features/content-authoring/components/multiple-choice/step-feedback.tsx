'use client';

import { useTranslations } from 'next-intl';
import { Check, X } from 'lucide-react';

import { Input, Textarea } from '@/components/ui/input';
import {
  correctOption,
  coverage,
  filledOptions,
  type Question,
} from '@/lib/shared-kernel/multiple-choice';

import { setOption, setQuestion, type MultipleChoiceDocument } from './edits';

const LETTERS = 'ABCDEFGH';

export interface StepFeedbackProps {
  exercise: MultipleChoiceDocument;
  onChange: (next: MultipleChoiceDocument) => void;
}

/**
 * Step 4: what the set says after a pick.
 *
 * The step this rewrite exists for. The old shape of this template had one `explanation`
 * per exercise and 48 of 131 seeded exercises had none at all, so a wrong pick was told
 * that it was wrong and nothing else. Two fields answer that here, and they are not the
 * same field twice:
 *
 *   * **the rule** behind the right answer, required on every question — shown when the
 *     question is answered correctly and when it closes without one. A set that can only
 *     ever say «not right» is the hole this plan closes, so a missing rule is a blocker;
 *   * **the rebuttal** of one wrong option, optional and worth writing for the distractors
 *     students actually fall for. That is the half the handoff spends most of its space on:
 *     "«-en» is the masculine ending, and «bok» is feminine" is worth more than a red cross.
 *
 * Only *written* options get a row. An option with no text does not reach a student, so a
 * field to explain it would be a field nobody will ever read.
 */
export function StepFeedback({ exercise, onChange }: StepFeedbackProps) {
  const t = useTranslations('Authoring');

  const cov = coverage(exercise);
  const percent = cov.wrongs === 0 ? 0 : Math.round((100 * cov.written) / cov.wrongs);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-base font-semibold">{t('multipleChoice.step4.title')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t('multipleChoice.step4.lede')}</p>
      </div>

      <section className="flex items-center gap-4 rounded-lg border border-border bg-surface p-4">
        <p className="text-2xl font-semibold tabular-nums">
          {cov.written}
          <span className="text-base text-muted-foreground"> / {cov.wrongs}</span>
        </p>
        <div className="flex-1">
          <div className="h-1.5 overflow-hidden rounded-full bg-(--ssz-bg-muted)">
            <div
              className="h-full rounded-full bg-(--ssz-color-primary-600)"
              style={{ width: `${percent}%` }}
            />
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">
            {t('multipleChoice.step4.coverage')} ·{' '}
            {cov.noWhy === 0
              ? t('multipleChoice.step4.coverageDone')
              : t('multipleChoice.step4.coverageMissing', { count: cov.noWhy })}
          </p>
        </div>
      </section>

      <ul className="flex flex-col gap-3">
        {exercise.questions.map((question, index) => (
          <li key={question.id}>
            <FeedbackCard
              question={question}
              index={index}
              exercise={exercise}
              onChange={onChange}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

/** One question's rule, and a line for each of its written wrong options. */
function FeedbackCard({
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
  const noWhy = question.why.trim() === '';
  const wrongs = filledOptions(question).filter((option) => !option.correct);
  const letterOf = (optionId: string): string => {
    const at = question.options.findIndex((option) => option.id === optionId);
    return LETTERS[at] ?? String(at + 1);
  };

  return (
    <div
      className={`flex flex-col gap-3 rounded-lg border bg-surface p-4 ${
        noWhy ? 'border-error' : 'border-border'
      }`}
    >
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className="grid size-5 shrink-0 place-items-center rounded-full bg-(--ssz-bg-muted) text-[11px] font-bold text-(--ssz-text-secondary)"
        >
          {index + 1}
        </span>
        <span className="min-w-0 truncate text-sm">
          {question.stem.trim() === '' ? t('multipleChoice.step4.untitled') : question.stem}
        </span>
        <span className="flex-1" />
        {/* The key, restated: the rule below is about *this* answer, and the author is
            writing it several screens away from where they chose it. */}
        <span
          className={`flex shrink-0 items-center gap-1 text-xs ${
            key === null || key.text.trim() === '' ? 'text-muted-foreground' : 'text-success-700'
          }`}
        >
          <Check className="size-3.5" aria-hidden />
          <span className="max-w-40 truncate">
            {key === null || key.text.trim() === ''
              ? t('multipleChoice.step4.noKey')
              : key.text}
          </span>
        </span>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium" htmlFor={`mc-why-${question.id}`}>
          {t('multipleChoice.step4.whyLabel')}
        </label>
        <Textarea
          id={`mc-why-${question.id}`}
          aria-describedby={`mc-why-help-${question.id}`}
          value={question.why}
          rows={2}
          hasError={noWhy}
          aria-invalid={noWhy}
          placeholder={t('multipleChoice.step4.whyPlaceholder')}
          onChange={(event) =>
            onChange(setQuestion(exercise, question.id, { why: event.target.value }))
          }
        />
        <p
          id={`mc-why-help-${question.id}`}
          className={`text-xs ${noWhy ? 'text-error' : 'text-muted-foreground'}`}
        >
          {noWhy ? t('multipleChoice.issues.Q_NO_WHY') : t('multipleChoice.step4.whyHelp')}
        </p>
      </div>

      {wrongs.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          {t('multipleChoice.step4.noWrongOptions')}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {wrongs.map((option) => {
            const written = option.why.trim() !== '';
            const letter = letterOf(option.id);

            return (
              <li key={option.id} className="flex items-center gap-2">
                {/* Written or not, said with a tick as well as a colour — and with a
                    label, because the state of a row is not something to read off a
                    green pixel. */}
                <span
                  className={`flex w-32 shrink-0 items-center gap-1.5 text-xs ${
                    written ? 'text-(--ssz-text-secondary)' : 'text-muted-foreground'
                  }`}
                  title={
                    written
                      ? t('multipleChoice.step4.written')
                      : t('multipleChoice.step4.notWritten')
                  }
                >
                  {written ? (
                    <Check className="size-3.5 shrink-0 text-success-500" aria-hidden />
                  ) : (
                    <X className="size-3.5 shrink-0 text-(--ssz-border-strong)" aria-hidden />
                  )}
                  <span className="truncate">{option.text}</span>
                  <span className="sr-only">
                    {written
                      ? t('multipleChoice.step4.written')
                      : t('multipleChoice.step4.notWritten')}
                  </span>
                </span>
                <Input
                  aria-label={t('multipleChoice.step4.optionWhyLabel', { letter })}
                  value={option.why}
                  placeholder={t('multipleChoice.step4.optionWhyPlaceholder')}
                  onChange={(event) =>
                    onChange(
                      setOption(exercise, question.id, option.id, { why: event.target.value }),
                    )
                  }
                />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

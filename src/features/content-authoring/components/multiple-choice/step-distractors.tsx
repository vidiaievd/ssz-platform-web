'use client';

import { useTranslations } from 'next-intl';
import { AlertTriangle, Check, Info, Lightbulb } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { audit, coverage, type Issue, type Question } from '@/lib/shared-kernel/multiple-choice';

import { setOption, type MultipleChoiceDocument } from './edits';
import { useIssueCopy } from './issue-copy';

const LETTERS = 'ABCDEFGH';

export interface StepDistractorsProps {
  exercise: MultipleChoiceDocument;
  onChange: (next: MultipleChoiceDocument) => void;
  /** The course's language. Decides which audit rules can speak — plan 53 §3.6. */
  language?: string;
}

/**
 * Step 2: are the wrong options doing any work.
 *
 * A read-and-fix step, and the only one whose whole content is derived: every line under
 * an option is `audit` from the kernel, rendered under the option it names. Nothing here
 * decides what counts as a bad distractor — that judgement is the same one the gate and
 * the server's preflight make, and a screen with an opinion of its own is how a builder
 * starts contradicting itself (IMPLEMENTATION.md).
 *
 * The options are editable in place rather than linked back to step 1: an author reading
 * "these two say the same thing" is one keystroke from fixing it, and sending them to
 * another screen to type it would be the whole cost of the step.
 *
 * Two of the six checks are language-bound and stay silent unless the course's language
 * has a pack (§3.6): hunting for Norwegian absolutes in Ukrainian text would be worse than
 * saying nothing, because a flag that misfires teaches an author to ignore the column.
 */
export function StepDistractors({ exercise, onChange, language }: StepDistractorsProps) {
  const t = useTranslations('Authoring');
  const describeIssue = useIssueCopy(exercise);

  const options = language === undefined ? {} : { language };
  const cov = coverage(exercise, options);
  const percent = cov.total === 0 ? 0 : Math.round((100 * cov.clean) / cov.total);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-base font-semibold">{t('multipleChoice.step2.title')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t('multipleChoice.step2.lede')}</p>
      </div>

      {/*
        "Clean" counts questions the audit has no *warning* about, which on a set of
        riktig/galt questions is legitimately zero: two options is a coin flip by nature,
        and the flag is right to say so every time (plan 53 §6.5, Q6). The strip is a
        reading of the set, not a target to drive to a hundred.
      */}
      <section className="flex items-center gap-4 rounded-lg border border-border bg-surface p-4">
        <p className="text-2xl font-semibold tabular-nums">
          {cov.clean}
          <span className="text-base text-muted-foreground"> / {cov.total}</span>
        </p>
        <div className="flex-1">
          <div className="h-1.5 overflow-hidden rounded-full bg-(--ssz-bg-muted)">
            <div
              className="h-full rounded-full bg-(--ssz-color-primary-600)"
              style={{ width: `${percent}%` }}
            />
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">
            {t('multipleChoice.step2.coverage')}
          </p>
        </div>
      </section>

      {exercise.questions.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t('multipleChoice.step2.empty')}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {exercise.questions.map((question, index) => (
            <li key={question.id}>
              <QuestionAudit
                question={question}
                index={index}
                exercise={exercise}
                flags={audit(question, options)}
                describeIssue={describeIssue}
                onChange={onChange}
              />
            </li>
          ))}
        </ul>
      )}

      <p className="flex items-start gap-2 rounded-lg border border-border bg-subtle p-3 text-xs text-muted-foreground">
        <Lightbulb className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        {t('multipleChoice.step2.tip')}
      </p>
    </div>
  );
}

/**
 * One question's options, each with whatever the audit has to say about it.
 *
 * Flags that name an option render under that option; flags about the question as a whole
 * — "two options is a coin flip" — collect at the foot of the card, because there is no
 * single row they belong to.
 */
function QuestionAudit({
  question,
  index,
  exercise,
  flags,
  describeIssue,
  onChange,
}: {
  question: Question;
  index: number;
  exercise: MultipleChoiceDocument;
  flags: Issue[];
  describeIssue: ReturnType<typeof useIssueCopy>;
  onChange: (next: MultipleChoiceDocument) => void;
}) {
  const t = useTranslations('Authoring');
  const cardFlags = flags.filter((flag) => !('optionId' in flag));

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className="grid size-5 shrink-0 place-items-center rounded-full bg-(--ssz-bg-muted) text-[11px] font-bold text-(--ssz-text-secondary)"
        >
          {index + 1}
        </span>
        <strong className="min-w-0 truncate text-sm font-medium">
          {question.stem.trim() === '' ? t('multipleChoice.step2.untitled') : question.stem}
        </strong>
        <span className="flex-1" />
        {flags.length === 0 ? (
          <span className="flex items-center gap-1 text-xs text-success-700">
            <Check className="size-3.5" aria-hidden />
            {t('multipleChoice.step2.clean')}
          </span>
        ) : (
          <span className="text-xs text-warning-700">
            {t('multipleChoice.step2.notes', { count: flags.length })}
          </span>
        )}
      </div>

      <ul className="flex flex-col gap-2">
        {question.options.map((option, at) => {
          const letter = LETTERS[at] ?? String(at + 1);
          const optionFlags = flags.filter(
            (flag) => 'optionId' in flag && flag.optionId === option.id,
          );

          return (
            <li key={option.id} className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
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
                  onChange={(event) =>
                    onChange(
                      setOption(exercise, question.id, option.id, { text: event.target.value }),
                    )
                  }
                />
                {/* `fixed`: never shuffled, always last. Its home is here rather than on
                    step 1 because it is a statement about the option's job — "Alle over"
                    is not an answer that can float into the middle of a list. */}
                <label
                  className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground"
                  title={t('multipleChoice.step2.pinLastHelp')}
                >
                  <Switch
                    checked={option.fixed}
                    aria-label={t('multipleChoice.step2.pinLast')}
                    onCheckedChange={(fixed) =>
                      onChange(setOption(exercise, question.id, option.id, { fixed }))
                    }
                  />
                  {t('multipleChoice.step2.pinLast')}
                </label>
              </div>
              {optionFlags.map((flag, at2) => (
                <FlagLine
                  key={`${flag.code}-${at2}`}
                  flag={flag}
                  text={describeIssue(flag, { bare: true })}
                />
              ))}
            </li>
          );
        })}
      </ul>

      {cardFlags.map((flag, at) => (
        <FlagLine key={`${flag.code}-${at}`} flag={flag} text={describeIssue(flag, { bare: true })} />
      ))}
    </div>
  );
}

/**
 * One audit finding, in the tone its level earns.
 *
 * `info` is the quieter half of the audit — an observation about a habit rather than a
 * fault — and the handoff keeps it inline only, never in the gate. The icon carries the
 * difference as well as the colour, because colour is never the only signal.
 */
function FlagLine({ flag, text }: { flag: Issue; text: string }) {
  const warn = flag.level === 'warning';

  return (
    <p
      className={`flex items-start gap-1.5 pl-9 text-xs ${
        warn ? 'text-warning-700' : 'text-muted-foreground'
      }`}
    >
      {warn ? (
        <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
      ) : (
        <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
      )}
      {text}
    </p>
  );
}

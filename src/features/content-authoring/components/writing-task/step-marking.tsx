'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronDown, ChevronUp, Info, Plus, Scale, Trash2, Wand2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import { Segmented } from '@/components/ui/segmented';
import {
  analyse,
  issues,
  rubricMax,
  type Criterion,
  type CriterionMetric,
  type ShowModelPolicy,
  type ShowRubricPolicy,
  type WritingTask,
} from '@/lib/shared-kernel/writing-task';

import {
  addCriterion,
  MAX_CRITERIA,
  MIN_CRITERIA,
  removeCriterion,
  setCriterion,
  setLevel,
  setSettings,
} from './edits';

/** Level descriptors are written top down: the author knows what "best" looks like. */
const LEVELS = [3, 2, 1, 0] as const;

const METRICS: CriterionMetric[] = ['points', 'paragraphs', 'language', 'lexis', null];

/** `null` is a real choice, so it needs a value a radio group can carry. */
const NO_METRIC = 'none';

export interface StepMarkingProps {
  exercise: WritingTask;
  onChange: (next: WritingTask) => void;
}

/**
 * Step 3: the rubric, and the score that counts as a pass.
 *
 * This is the step that matters most and shows least. A free text has no key, so nothing
 * on this screen can be checked by typing the right answer — the rubric *is* the answer
 * key, in the sense that it is the only thing standing between two teachers marking the
 * same text and disagreeing by four points. That is why the level descriptors are edited
 * here as prose rather than picked from a scale: `2 — noen feil som ikke forstyrrer` is
 * something two people can apply the same way, and "2 out of 3" is not.
 *
 * The tester at the bottom is the nearest thing to a self-test that exists. It runs the
 * same `analyse()` the queue runs, so what it suggests is what a teacher will see
 * pre-computed beside a real submission — and its note is careful to say which criteria
 * that covers. The placeholder asks for a weak answer on purpose: a strong one tells the
 * author nothing they did not already believe.
 */
export function StepMarking({ exercise, onChange }: StepMarkingProps) {
  const t = useTranslations('Authoring');
  const s = exercise.settings;
  const max = rubricMax(exercise);
  const problems = issues(exercise).filter((issue) => issue.step === 3);
  const passTooHigh = problems.some((issue) => issue.code === 'PASS_SCORE_TOO_HIGH');
  const noModel = problems.some((issue) => issue.code === 'EX_NO_MODEL');

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-base font-semibold">{t('writingTask.step3.title')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t('writingTask.step3.lede')}</p>
      </div>

      <section className="flex flex-wrap items-center gap-4 rounded-lg border border-border bg-surface p-4">
        <div>
          <p className="text-xl font-semibold leading-none">
            {t('writingTask.step3.maxPoints', { max })}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{t('writingTask.step3.maxHelp')}</p>
        </div>

        <div className="min-w-40 flex-1">
          <div
            className="h-2 overflow-hidden rounded-full bg-(--ssz-bg-subtle)"
            role="presentation"
          >
            <div
              className={`h-full rounded-full ${passTooHigh ? 'bg-error' : 'bg-primary'}`}
              style={{ width: `${max > 0 ? Math.min(100, (s.passScore / max) * 100) : 0}%` }}
            />
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">
            {t('writingTask.step3.passHelp', { passScore: s.passScore, max })}
          </p>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium" htmlFor="wt-pass-score">
            {t('writingTask.step3.passLabel')}
          </label>
          <Input
            id="wt-pass-score"
            type="number"
            min={1}
            max={max}
            className="w-24"
            value={s.passScore}
            hasError={passTooHigh}
            aria-invalid={passTooHigh}
            onChange={(event) =>
              onChange(setSettings(exercise, { passScore: readScore(event.target.value) }))
            }
          />
        </div>

        {passTooHigh && (
          <p className="w-full text-xs text-error" role="status">
            {t('writingTask.step3.passTooHigh', { passScore: s.passScore, max })}
          </p>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="text-xs font-medium">{t('writingTask.step3.criteriaLabel')}</h3>

        {/*
          With no criteria there is no card to carry the blocker, so the step's red dot
          would point at a screen with nothing wrong on it. The pass-mark bar above says
          the same thing in numbers (a threshold out of zero); this says it in words, next
          to the button that fixes it.
        */}
        {exercise.rubric.length === 0 && (
          <p className="text-xs text-error" role="status">
            {t('writingTask.issues.RUBRIC_EMPTY')}
          </p>
        )}

        {exercise.rubric.map((criterion, index) => (
          <CriterionCard
            key={criterion.id}
            exercise={exercise}
            criterion={criterion}
            index={index + 1}
            onChange={onChange}
          />
        ))}
        <div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={exercise.rubric.length >= MAX_CRITERIA}
            onClick={() => onChange(addCriterion(exercise))}
          >
            <Plus className="size-3.5" aria-hidden />
            {t('writingTask.step3.addCriterion')}
          </Button>
        </div>
      </section>

      <section className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="max-w-md">
            <p className="text-sm">{t('writingTask.step3.showRubricLabel')}</p>
            <p className="text-xs text-muted-foreground">{t('writingTask.step3.showRubricHelp')}</p>
          </div>
          <Segmented<ShowRubricPolicy>
            aria-label={t('writingTask.step3.showRubricLabel')}
            value={s.showRubric}
            onValueChange={(showRubric) => onChange(setSettings(exercise, { showRubric }))}
            options={[
              { value: 'always', label: t('writingTask.step3.showRubricAlways') },
              { value: 'afterGraded', label: t('writingTask.step3.showRubricAfter') },
              { value: 'never', label: t('writingTask.step3.showRubricNever') },
            ]}
          />
        </div>

        {/* The one setting on this step that changes what the student sees while writing:
            `always` sends the level descriptors down with the task (plan 50 §5), which is
            the whole point of it and worth saying out loud before it is chosen. */}
        {s.showRubric === 'always' && (
          <Callout>{t('writingTask.step3.showRubricAlwaysNote')}</Callout>
        )}

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="max-w-md">
            <p className="text-sm">{t('writingTask.step3.showModelLabel')}</p>
            <p className="text-xs text-muted-foreground">{t('writingTask.step3.showModelHelp')}</p>
          </div>
          <Segmented<ShowModelPolicy>
            aria-label={t('writingTask.step3.showModelLabel')}
            value={s.showModel}
            onValueChange={(showModel) => onChange(setSettings(exercise, { showModel }))}
            options={[
              { value: 'afterGraded', label: t('writingTask.step3.showModelAfter') },
              { value: 'never', label: t('writingTask.step3.showModelNever') },
            ]}
          />
        </div>

        {/* The example answer is edited on step 1; the kernel files its absence under
            this step because this is where it is decided whether anyone ever reads it.
            Saying where to write it beats sending the author to look for a field the
            gate's "step 3" implies is here. */}
        {noModel && s.showModel === 'afterGraded' && (
          <p className="text-xs text-warning-700" role="status">
            {t('writingTask.step3.noModelYet')}
          </p>
        )}
      </section>

      <Tester exercise={exercise} />
    </div>
  );
}

/**
 * One criterion: what it is called, what it weighs, and what each of the four marks means.
 *
 * Collapsed by default and summarised by its top and bottom descriptor, because a rubric
 * of four criteria fully expanded is sixteen text fields and no shape. The delete button
 * stops at two criteria — the kernel enforces the same floor, and a disabled button that
 * says why beats a click that silently does nothing.
 */
function CriterionCard({
  exercise,
  criterion,
  index,
  onChange,
}: {
  exercise: WritingTask;
  criterion: Criterion;
  index: number;
  onChange: (next: WritingTask) => void;
}) {
  const t = useTranslations('Authoring');
  const [open, setOpen] = useState(false);
  const unnamed = criterion.name.trim() === '';
  const atFloor = exercise.rubric.length <= MIN_CRITERIA;

  return (
    <div
      className={`flex flex-col gap-3 rounded-lg border p-3 ${
        unnamed ? 'border-error/50' : 'border-border'
      }`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Scale className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        <Input
          className="min-w-40 flex-1"
          value={criterion.name}
          hasError={unnamed}
          aria-invalid={unnamed}
          aria-label={t('writingTask.step3.criterionName', { index })}
          placeholder={t('writingTask.step3.criterionNamePlaceholder')}
          onChange={(event) =>
            onChange(setCriterion(exercise, criterion.id, { name: event.target.value }))
          }
        />
        <Segmented<'1' | '2'>
          size="sm"
          aria-label={t('writingTask.step3.weightLabel', { index })}
          value={String(criterion.weight) as '1' | '2'}
          onValueChange={(value) =>
            onChange(setCriterion(exercise, criterion.id, { weight: Number(value) as 1 | 2 }))
          }
          options={[
            { value: '1', label: t('writingTask.step3.weightOne') },
            { value: '2', label: t('writingTask.step3.weightTwo') },
          ]}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-expanded={open}
          aria-label={t('writingTask.step3.levelsToggle', { index })}
          onClick={() => setOpen(!open)}
        >
          {open ? (
            <ChevronUp className="size-4" aria-hidden />
          ) : (
            <ChevronDown className="size-4" aria-hidden />
          )}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={atFloor}
          title={atFloor ? t('writingTask.step3.removeFloor', { count: MIN_CRITERIA }) : undefined}
          aria-label={t('writingTask.step3.removeCriterion', { index })}
          onClick={() => onChange(removeCriterion(exercise, criterion.id))}
        >
          <Trash2 className="size-4 text-error" aria-hidden />
        </Button>
      </div>

      <Input
        value={criterion.desc}
        aria-label={t('writingTask.step3.criterionDesc', { index })}
        placeholder={t('writingTask.step3.criterionDescPlaceholder')}
        onChange={(event) =>
          onChange(setCriterion(exercise, criterion.id, { desc: event.target.value }))
        }
      />

      {open ? (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            {LEVELS.map((level) => (
              <div key={level} className="flex items-center gap-2">
                <span
                  className={`grid size-6 shrink-0 place-items-center rounded-md text-xs font-semibold ${
                    level === 3
                      ? 'bg-success-100 text-success-700'
                      : 'bg-(--ssz-bg-subtle) text-muted-foreground'
                  }`}
                >
                  {level}
                </span>
                <Input
                  className="flex-1"
                  value={criterion.levels[level]}
                  aria-label={t('writingTask.step3.levelLabel', { index, level })}
                  placeholder={
                    level === 3
                      ? t('writingTask.step3.levelTopPlaceholder')
                      : t('writingTask.step3.levelPlaceholder')
                  }
                  onChange={(event) =>
                    onChange(setLevel(exercise, criterion.id, level, event.target.value))
                  }
                />
              </div>
            ))}
          </div>

          {/* Not in the handoff, which suggested marks from a criterion's position in the
              list. Plan 50 §3.4 replaced that with a named metric, and a named metric the
              author cannot name leaves every criterion they add without a suggestion for
              good. It sits inside the expanded body because it is a property of what the
              criterion measures, next to the descriptors that say the same thing in prose. */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium">{t('writingTask.step3.metricLabel')}</span>
            <Segmented<string>
              size="sm"
              aria-label={t('writingTask.step3.metricAria', { index })}
              value={criterion.metric ?? NO_METRIC}
              onValueChange={(value) =>
                onChange(
                  setCriterion(exercise, criterion.id, {
                    metric: value === NO_METRIC ? null : (value as CriterionMetric),
                  }),
                )
              }
              options={METRICS.map((metric) => ({
                value: metric ?? NO_METRIC,
                label: t(
                  `writingTask.step3.metric.${metric ?? NO_METRIC}` as 'writingTask.step3.metric.points',
                ),
              }))}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {criterion.metric === null
              ? t('writingTask.step3.metricNoneHelp')
              : t('writingTask.step3.metricHelp')}
          </p>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          {t('writingTask.step3.levelsSummary', {
            top: criterion.levels[3].trim() || '—',
            bottom: criterion.levels[0].trim() || '—',
          })}
        </p>
      )}
    </div>
  );
}

/**
 * Paste a real answer, see what the rubric makes of it.
 *
 * Deliberately not a grader. Every number here comes from `analyse()`, which measures
 * coverage, length, paragraphs and word variety and refuses to guess at grammar — so the
 * note under the result names what is computed and what waits for a model rather than
 * letting a total that includes a placeholder `2` for language read as a mark.
 */
function Tester({ exercise }: { exercise: WritingTask }) {
  const t = useTranslations('Authoring');
  const [text, setText] = useState('');
  const analysis = analyse(exercise, text);
  const max = rubricMax(exercise);
  const written = text.trim() !== '';
  const passes = analysis.total >= exercise.settings.passScore;

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-dashed border-border p-4">
      <h3 className="flex items-center gap-2 text-xs font-medium">
        <Wand2 className="size-3.5" aria-hidden />
        {t('writingTask.step3.testerLabel')}
      </h3>
      <Textarea
        rows={4}
        value={text}
        aria-label={t('writingTask.step3.testerLabel')}
        placeholder={t('writingTask.step3.testerPlaceholder')}
        onChange={(event) => setText(event.target.value)}
      />

      {written && (
        <>
          <div className="flex flex-col gap-2">
            {exercise.rubric.map((criterion) => {
              const mark = analysis.suggested[criterion.id];
              return (
                <div
                  key={criterion.id}
                  className="flex items-center justify-between gap-3 rounded-lg bg-(--ssz-bg-subtle) px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {criterion.name.trim() || t('writingTask.step3.criterionUnnamed')}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {mark === undefined
                        ? t('writingTask.step3.testerNoSuggestion')
                        : criterion.levels[mark].trim() || '—'}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold tabular-nums">
                    {mark === undefined ? '—' : t('writingTask.step3.testerMark', { mark })}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-semibold tabular-nums">
              {t('writingTask.step3.testerScore', { total: analysis.total, max })}
            </span>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                passes ? 'bg-success-100 text-success-700' : 'bg-warning-50 text-warning-700'
              }`}
            >
              {passes ? t('writingTask.step3.testerPass') : t('writingTask.step3.testerRewrite')}
            </span>
            <span className="text-xs text-muted-foreground">
              {t('writingTask.step3.testerFacts', {
                words: analysis.words,
                paragraphs: analysis.paragraphs,
                hit: analysis.hitCount,
                needed: analysis.neededCount,
              })}
            </span>
          </div>

          <Callout>{t('writingTask.step3.testerNote')}</Callout>
        </>
      )}
    </section>
  );
}

/** A quiet note the author is meant to read once, not a warning about their document. */
function Callout({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-2 rounded-lg bg-(--ssz-bg-subtle) p-3 text-xs text-muted-foreground">
      <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
      <span>{children}</span>
    </p>
  );
}

/**
 * A pass mark out of a number field.
 *
 * Zero is clamped away because a threshold of 0 is not "no threshold", it is a task
 * everyone passes without writing anything — and unlike `maxWords: 0` there is no reading
 * of it that anyone wants. Above the ceiling is left alone: that is `PASS_SCORE_TOO_HIGH`,
 * and the author is mid-edit on a rubric they may be about to grow.
 */
function readScore(value: string): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? Math.max(1, parsed) : 1;
}

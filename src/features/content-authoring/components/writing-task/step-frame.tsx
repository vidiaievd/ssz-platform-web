'use client';

import { useTranslations } from 'next-intl';
import { RotateCcw, ShieldAlert } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Segmented } from '@/components/ui/segmented';
import { issues, LEN_DEFAULTS, type WritingTask } from '@/lib/shared-kernel/writing-task';

import { isDefaultRange, resetRange, setSettings } from './edits';
import { ToggleRow } from '../toggle-row';

/** Off, and the three lengths a written task is realistically given. */
const TIMERS = [0, 20, 40, 60] as const;

export interface StepFrameProps {
  exercise: WritingTask;
  onChange: (next: WritingTask) => void;
}

/**
 * Step 2: how long the text has to be, how long the student has, and what they can see
 * while they write.
 *
 * Every setting here is about the conditions rather than the task. That is why the word
 * range sits beside the timer and not beside the prompt: `minWords` is not a fact about
 * the subject, it is the bar the submit button is held behind, and an author deciding it
 * should be looking at the clock at the same time.
 *
 * The two problems this step can hold are shown where they are caused rather than only in
 * the gate — a maximum under the minimum next to the two numbers, a timer too short for
 * the length next to the clock. The gate lists them again; a blocker nobody can see until
 * they press `Ferdig` is a blocker found late.
 */
export function StepFrame({ exercise, onChange }: StepFrameProps) {
  const t = useTranslations('Authoring');
  const s = exercise.settings;
  const problems = issues(exercise).filter((issue) => issue.step === 2);
  const rangeInverted = problems.some((issue) => issue.code === 'LEN_MAX_LTE_MIN');
  const timerTight = problems.some((issue) => issue.code === 'TIMER_TOO_SHORT');
  const [defaultMin, defaultMax] = LEN_DEFAULTS[exercise.mode];

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-base font-semibold">{t('writingTask.step2.title')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t('writingTask.step2.lede')}</p>
      </div>

      <section className="flex flex-col gap-2">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium" htmlFor="wt-min-words">
              {t('writingTask.step2.minLabel')}
            </label>
            <Input
              id="wt-min-words"
              type="number"
              min={0}
              className="w-28"
              value={s.minWords}
              hasError={rangeInverted}
              aria-invalid={rangeInverted}
              onChange={(event) =>
                onChange(setSettings(exercise, { minWords: readCount(event.target.value) }))
              }
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium" htmlFor="wt-max-words">
              {t('writingTask.step2.maxLabel')}
            </label>
            <Input
              id="wt-max-words"
              type="number"
              min={0}
              className="w-28"
              value={s.maxWords}
              hasError={rangeInverted}
              aria-invalid={rangeInverted}
              onChange={(event) =>
                onChange(setSettings(exercise, { maxWords: readCount(event.target.value) }))
              }
            />
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium">{t('writingTask.step2.timerLabel')}</span>
            <Segmented
              aria-label={t('writingTask.step2.timerLabel')}
              value={String(s.timer)}
              onValueChange={(value) => onChange(setSettings(exercise, { timer: Number(value) }))}
              options={TIMERS.map((minutes) => ({
                value: String(minutes),
                label:
                  minutes === 0
                    ? t('writingTask.step2.timerOff')
                    : t('writingTask.step2.timerMinutes', { minutes }),
              }))}
            />
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          {s.maxWords === 0
            ? t('writingTask.step2.maxOff')
            : t('writingTask.step2.rangeHelp', { min: s.minWords, max: s.maxWords })}
        </p>

        {rangeInverted && (
          <p className="text-xs text-error" role="status">
            {t('writingTask.step2.rangeInverted')}
          </p>
        )}

        {timerTight && (
          <p className="text-xs text-warning-700" role="status">
            {t('writingTask.step2.timerTight', { timer: s.timer, count: s.minWords })}
          </p>
        )}

        {/* Offered, not enforced: a range that differs from the default is usually a
            decision, and occasionally a leftover from a mode switch two edits ago. */}
        {!isDefaultRange(exercise) && (
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {t('writingTask.step2.notDefault', {
              mode: t(`writingTask.modes.${exercise.mode}` as 'writingTask.modes.letter'),
              min: defaultMin,
              max: defaultMax,
            })}
            <Button
              type="button"
              variant="link"
              size="sm"
              onClick={() => onChange(resetRange(exercise))}
            >
              <RotateCcw className="size-3.5" aria-hidden />
              {t('writingTask.step2.resetRange')}
            </Button>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
        <h3 className="text-xs font-medium">{t('writingTask.step2.conditionsLabel')}</h3>
        <ToggleRow
          label={t('writingTask.step2.blockPasteLabel')}
          help={t('writingTask.step2.blockPasteHelp')}
          checked={s.blockPaste}
          onChange={(blockPaste) => onChange(setSettings(exercise, { blockPaste }))}
        />
        <ToggleRow
          label={t('writingTask.step2.autosaveLabel')}
          help={t('writingTask.step2.autosaveHelp')}
          checked={s.autosave}
          onChange={(autosave) => onChange(setSettings(exercise, { autosave }))}
        />
        <ToggleRow
          label={t('writingTask.step2.showWordCountLabel')}
          help={t('writingTask.step2.showWordCountHelp')}
          checked={s.showWordCount}
          onChange={(showWordCount) => onChange(setSettings(exercise, { showWordCount }))}
        />
      </section>

      {s.blockPaste && (
        <p className="flex items-start gap-2 rounded-lg border border-warning-500/40 bg-warning-50 p-3 text-xs text-warning-700 dark:bg-transparent">
          <ShieldAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <span>{t('writingTask.step2.pasteWarning')}</span>
        </p>
      )}

      <section className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
        <h3 className="text-xs font-medium">{t('writingTask.step2.helpersLabel')}</h3>
        <ToggleRow
          label={t('writingTask.step2.showPlanLabel')}
          help={t('writingTask.step2.showPlanHelp')}
          checked={s.showPlan}
          onChange={(showPlan) => onChange(setSettings(exercise, { showPlan }))}
        />
        <ToggleRow
          label={t('writingTask.step2.showPhrasesLabel')}
          help={t('writingTask.step2.showPhrasesHelp')}
          checked={s.showPhrases}
          // On with nothing to show is not a setting, it is a blank space on the
          // student's screen. The reason names the step that fixes it.
          disabledReason={
            exercise.phrases.length === 0 ? t('writingTask.step2.noPhrases') : undefined
          }
          onChange={(showPhrases) => onChange(setSettings(exercise, { showPhrases }))}
        />
      </section>
    </div>
  );
}

/**
 * A word count out of a number field.
 *
 * An empty field reads as 0 rather than `NaN`, and 0 is a real setting on both of these —
 * no minimum, no ceiling. Negative is not: a `-40` typed into `minWords` would gate
 * nothing and read as a bug on the student's screen.
 */
function readCount(value: string): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

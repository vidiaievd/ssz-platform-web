'use client';

import { useTranslations } from 'next-intl';
import { AlertTriangle, Info } from 'lucide-react';

import { Segmented } from '@/components/ui/segmented';
import {
  coverage,
  type Check,
  type ErrorCorrection,
  type Hints,
  type StrayPolicy,
} from '@/lib/shared-kernel/error-correction';

import { EcTester } from './ec-tester';
import { ToggleRow } from './toggle-row';

/**
 * The thresholds the segmented control offers, loosest first. Named rather than keyed by
 * their number: a message key cannot hold a `.`, which is how next-intl expresses nesting.
 */
const NEAR_STEPS = [
  { value: 0.75, name: 'loose' },
  { value: 0.85, name: 'normal' },
  { value: 0.95, name: 'strict' },
] as const;

const STRAY_POLICIES: StrayPolicy[] = ['ignore', 'flag', 'block'];

export interface StepCheckProps {
  exercise: ErrorCorrection;
  onChange: (next: ErrorCorrection) => void;
}

/**
 * Step 3: what the student is told before answering, and what the machine accepts.
 *
 * The two groups are deliberately one screen. Whether the count is shown decides if the
 * task is an exercise or a guessing game, and how strictly the text is read decides how
 * much of that lands on a teacher — an author who tunes one without seeing the other is
 * tuning half a thing. The tester is repeated at the foot for the same reason: this is
 * where the rules change, so this is where trying them has to be possible.
 */
export function StepCheck({ exercise, onChange }: StepCheckProps) {
  const t = useTranslations('Authoring');
  const { hints, check } = exercise;
  const totals = coverage(exercise);

  const setHints = (patch: Partial<Hints>) =>
    onChange({ ...exercise, hints: { ...hints, ...patch } });
  const setCheck = (patch: Partial<Check>) =>
    onChange({ ...exercise, check: { ...check, ...patch } });

  /**
   * The nearest offered threshold. A document can carry any number — the server takes
   * one, and older documents may — so the control shows where that number sits rather
   * than silently showing nothing selected.
   */
  /**
   * Two settings can be on screen while meaning nothing at all, and a switch that does
   * nothing is worse than a missing one — the author sets it and believes it took.
   *
   * `requireAllSpans` is read only when the check decides to approve (`route`), so with
   * nothing ever approved it cannot change an outcome. `hintText` unlocks a hint that has
   * to have been written in step 2 first.
   */
  const hintsWritten = exercise.items.some((item) => (item.hint ?? '').trim() !== '');

  const nearStep = NEAR_STEPS.reduce((closest, step) =>
    Math.abs(step.value - check.near) < Math.abs(closest.value - check.near) ? step : closest,
  );

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-base font-semibold">{t('errorCorrection.step3.title')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t('errorCorrection.step3.lede')}</p>
      </div>

      <section className="flex flex-col gap-2">
        <h3 className="text-xs font-medium">{t('errorCorrection.step3.toldGroup')}</h3>
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
          <ToggleRow
            label={t('errorCorrection.step3.countLabel')}
            help={t('errorCorrection.step3.countHelp', { count: totals.errors })}
            checked={hints.count}
            onChange={(value) => setHints({ count: value })}
          />
          {exercise.mode === 'passage' && (
            <ToggleRow
              label={t('errorCorrection.step3.markLabel')}
              help={t('errorCorrection.step3.markHelp')}
              checked={hints.mark}
              onChange={(value) => setHints({ mark: value })}
            />
          )}
          <ToggleRow
            label={t('errorCorrection.step3.hintTextLabel')}
            help={t('errorCorrection.step3.hintTextHelp')}
            checked={hints.hintText}
            disabledReason={hintsWritten ? undefined : t('errorCorrection.step3.noHintsWritten')}
            onChange={(value) => setHints({ hintText: value })}
          />
          <ToggleRow
            label={t('errorCorrection.step3.showTypeLabel')}
            help={t('errorCorrection.step3.showTypeHelp')}
            checked={hints.showType}
            onChange={(value) => setHints({ showType: value })}
          />
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-xs font-medium">{t('errorCorrection.step3.checkGroup')}</h3>
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
          <ToggleRow
            label={t('errorCorrection.step3.onLabel')}
            help={t('errorCorrection.step3.onHelp')}
            checked={check.on}
            onChange={(value) => setCheck({ on: value })}
          />
          {check.on && (
            <>
              <ToggleRow
                label={t('errorCorrection.step3.exactPassLabel')}
                help={t('errorCorrection.step3.exactPassHelp')}
                checked={check.exactPass}
                onChange={(value) => setCheck({ exactPass: value })}
              />
              <ToggleRow
                label={t('errorCorrection.step3.requireAllSpansLabel')}
                help={t('errorCorrection.step3.requireAllSpansHelp')}
                checked={check.requireAllSpans}
                disabledReason={
                  check.exactPass ? undefined : t('errorCorrection.step3.nothingApproved')
                }
                onChange={(value) => setCheck({ requireAllSpans: value })}
              />
              <ToggleRow
                label={t('errorCorrection.step3.typoLabel')}
                help={t('errorCorrection.step3.typoHelp')}
                checked={check.typo}
                onChange={(value) => setCheck({ typo: value })}
              />
              <ToggleRow
                label={t('errorCorrection.step3.caseLabel')}
                help={t('errorCorrection.step3.caseHelp')}
                checked={check.caseInsensitive}
                onChange={(value) => setCheck({ caseInsensitive: value })}
              />
              <ToggleRow
                label={t('errorCorrection.step3.punctLabel')}
                help={t('errorCorrection.step3.punctHelp')}
                checked={check.ignorePunct}
                onChange={(value) => setCheck({ ignorePunct: value })}
              />
            </>
          )}
        </div>
      </section>

      {check.on ? (
        <>
          <section className="flex flex-col gap-2">
            <h3 className="text-xs font-medium">{t('errorCorrection.step3.strayLabel')}</h3>
            <Segmented
              aria-label={t('errorCorrection.step3.strayLabel')}
              value={check.strayEdits}
              onValueChange={(value) => setCheck({ strayEdits: value })}
              options={STRAY_POLICIES.map((policy) => ({
                value: policy,
                label: t(
                  `errorCorrection.step3.stray.${policy}` as 'errorCorrection.step3.stray.flag',
                ),
              }))}
            />
            <Explain>
              {t(
                `errorCorrection.step3.strayHelp.${check.strayEdits}` as 'errorCorrection.step3.strayHelp.flag',
              )}
            </Explain>
          </section>

          <section className="flex flex-col gap-2">
            <h3 className="text-xs font-medium">{t('errorCorrection.step3.nearLabel')}</h3>
            <Segmented
              aria-label={t('errorCorrection.step3.nearLabel')}
              value={String(nearStep.value)}
              onValueChange={(value) => setCheck({ near: Number(value) })}
              options={NEAR_STEPS.map((step) => ({
                value: String(step.value),
                label: t(
                  `errorCorrection.step3.near.${step.name}` as 'errorCorrection.step3.near.normal',
                ),
              }))}
            />
            <Explain>
              {t('errorCorrection.step3.nearHelp', { percent: Math.round(check.near * 100) })}
            </Explain>
          </section>
        </>
      ) : (
        <p className="flex items-start gap-2 rounded-md border border-warning-300 bg-warning-50 px-4 py-3 text-sm text-warning-700">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          {t('errorCorrection.step3.offWarning')}
        </p>
      )}

      <EcTester exercise={exercise} />
    </div>
  );
}

function Explain({ children }: { children: string }) {
  return (
    <p className="flex items-start gap-2 text-xs text-muted-foreground">
      <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
      {children}
    </p>
  );
}

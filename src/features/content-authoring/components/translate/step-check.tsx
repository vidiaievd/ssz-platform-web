'use client';

import { useTranslations } from 'next-intl';
import { AlertTriangle, Ban, Check as CheckIcon, Info, Plus, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Segmented } from '@/components/ui/segmented';
import {
  coverage,
  route,
  runItems,
  type Check,
  type Item,
  type Translate,
  type Verdict,
} from '@/lib/shared-kernel/translate';

import { addGuard, removeGuard, setGuard, type GuardKind } from './edits';
import { TrTester } from './tr-tester';
import { ToggleRow } from '../toggle-row';
import { RouteChip, VerdictChip } from './tr-marks';

const READING = 'var(--ssz-font-reading)';

/**
 * The rungs of the ladder, best first — the four an answer with words in it can reach.
 * `empty` and `noref` are states of the exercise rather than judgements of an answer, so
 * they are not rows in a table about where answers go.
 */
const ROUTED_VERDICTS: Verdict[] = ['exact', 'typo', 'near', 'off'];

/**
 * The thresholds offered, loosest first. Named rather than keyed by their number: a
 * message key cannot hold a `.`, which is how next-intl expresses nesting. Same three
 * rungs as `error_correction`, so an author who has tuned one template recognises this.
 */
const NEAR_STEPS = [
  { value: 0.7, name: 'loose' },
  { value: 0.8, name: 'normal' },
  { value: 0.9, name: 'strict' },
] as const;

const GUARD_KINDS: GuardKind[] = ['require', 'forbid'];

export interface StepCheckProps {
  exercise: Translate;
  onChange: (next: Translate) => void;
}

/**
 * Step 3 of the translate builder: what the machine accepts, and what it is allowed to do
 * about it.
 *
 * The routing table comes first, before any switch, because it is the one thing about this
 * template authors get wrong. The auto-check may only ever approve (BEHAVIOR.md,
 * "Дизайн-решения" §1): a translation that misses the key is very often a second good
 * translation nobody wrote down, so `typo`, `near` and `off` all mean the same thing for
 * the student — a teacher will read it. The settings under the table move the boundary
 * between rows; none of them creates a fifth outcome.
 *
 * The guards are the exception, and that is why they live on this step rather than with
 * the sentences. A fired `require` or `forbid` is the only deviation this engine can name
 * exactly, so it is the only place an automatic message about a wrong answer is honest —
 * hence the note beside every one of them.
 */
export function StepCheck({ exercise, onChange }: StepCheckProps) {
  const t = useTranslations('Authoring');
  const { check } = exercise;
  const totals = coverage(exercise);
  const items = runItems(exercise);

  const setCheck = (patch: Partial<Check>) =>
    onChange({ ...exercise, check: { ...check, ...patch } });

  /**
   * The nearest offered threshold. A document can carry any number — the server takes one,
   * and a document written before these three rungs existed may — so the control shows
   * where that number sits rather than silently showing nothing selected.
   */
  const nearStep = NEAR_STEPS.reduce((closest, step) =>
    Math.abs(step.value - check.near) < Math.abs(closest.value - check.near) ? step : closest,
  );

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-base font-semibold">{t('translate.step3.title')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t('translate.step3.lede')}</p>
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
        <ToggleRow
          label={t('translate.step3.onLabel')}
          help={t('translate.step3.onHelp')}
          checked={check.on}
          onChange={(value) => setCheck({ on: value })}
        />
        {check.on && (
          <ToggleRow
            label={t('translate.step3.exactPassLabel')}
            help={t('translate.step3.exactPassHelp')}
            checked={check.exactPass}
            onChange={(value) => setCheck({ exactPass: value })}
          />
        )}
      </div>

      {/*
        Where each verdict goes, under the settings as they stand. The pills are computed
        through the kernel's own `route`, not written out as prose, so the table cannot
        claim an outcome the server would not produce.
      */}
      <section className="flex flex-col gap-2">
        <h3 className="text-xs font-medium">{t('translate.step3.routingTitle')}</h3>
        <ul className="flex flex-col gap-2">
          {ROUTED_VERDICTS.map((verdict) => {
            const routing = route(check, {
              verdict,
              sim: 0,
              tokens: [],
              ref: '',
              missing: [],
              banned: [],
              exact: verdict === 'exact',
            });

            return (
              <li
                key={verdict}
                className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-surface p-3"
              >
                <VerdictChip verdict={verdict} />
                <span className="min-w-48 flex-1">
                  <span className="block text-sm font-medium">
                    {t(`translate.step3.route.${verdict}` as 'translate.step3.route.exact')}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {t(`translate.step3.routeHelp.${verdict}` as 'translate.step3.routeHelp.exact')}
                  </span>
                </span>
                <RouteChip routing={routing} />
              </li>
            );
          })}
        </ul>
      </section>

      {check.on ? (
        <>
          <section className="flex flex-col gap-2">
            <h3 className="text-xs font-medium">{t('translate.step3.normGroup')}</h3>
            <p className="text-xs text-muted-foreground">{t('translate.step3.normLede')}</p>
            <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
              <ToggleRow
                label={t('translate.step3.caseLabel')}
                help={t('translate.step3.caseHelp')}
                checked={check.caseInsensitive}
                onChange={(value) => setCheck({ caseInsensitive: value })}
              />
              <ToggleRow
                label={t('translate.step3.punctLabel')}
                help={t('translate.step3.punctHelp')}
                checked={check.ignorePunct}
                onChange={(value) => setCheck({ ignorePunct: value })}
              />
              <ToggleRow
                label={t('translate.step3.typoLabel')}
                help={t('translate.step3.typoHelp')}
                checked={check.typo}
                onChange={(value) => setCheck({ typo: value })}
              />
              <ToggleRow
                label={t('translate.step3.foldLabel')}
                help={t('translate.step3.foldHelp')}
                checked={check.foldDiacritics}
                onChange={(value) => setCheck({ foldDiacritics: value })}
              />
            </div>
            {/* The one normalisation that hides a real mistake, so it says so where it is
                switched on and not only in the finish gate. */}
            {check.foldDiacritics && (
              <p
                className="flex items-start gap-2 rounded-md border border-warning-300 bg-warning-50 px-3 py-2 text-xs text-warning-700"
                role="status"
              >
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                {t('translate.step3.foldWarning')}
              </p>
            )}
          </section>

          <section className="flex flex-col gap-2">
            <h3 className="text-xs font-medium">{t('translate.step3.nearLabel')}</h3>
            <Segmented
              aria-label={t('translate.step3.nearLabel')}
              value={String(nearStep.value)}
              onValueChange={(value) => setCheck({ near: Number(value) })}
              options={NEAR_STEPS.map((step) => ({
                value: String(step.value),
                label: t(`translate.step3.near.${step.name}` as 'translate.step3.near.normal'),
              }))}
            />
            <Explain>
              {t('translate.step3.nearHelp', { percent: Math.round(check.near * 100) })}
            </Explain>
          </section>
        </>
      ) : (
        <p className="flex items-start gap-2 rounded-md border border-warning-300 bg-warning-50 px-4 py-3 text-sm text-warning-700">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          {t('translate.step3.offWarning')}
        </p>
      )}

      <section className="flex flex-col gap-2">
        <h3 className="text-xs font-medium">{t('translate.step3.guardsTitle')}</h3>
        <p className="text-xs text-muted-foreground">{t('translate.step3.guardsLede')}</p>

        {items.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
            {t('translate.step3.guardsNoItems')}
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {items.map((item, index) => (
              <li key={item.id}>
                <GuardCard exercise={exercise} item={item} index={index} onChange={onChange} />
              </li>
            ))}
          </ul>
        )}

        {totals.guards > 0 && (
          <p className="text-xs text-muted-foreground">
            {t('translate.step3.guardsExplained', {
              explained: totals.guardsExplained,
              total: totals.guards,
            })}
          </p>
        )}
      </section>

      {/* The coverage line the handoff puts at the foot of this step: how much of the set
          accepts a second wording, which is what decides how big the queue gets. */}
      {totals.withRef > 0 && (
        <p className="flex items-start gap-2 rounded-md border border-border bg-[var(--ssz-bg-subtle)] px-4 py-3 text-sm text-[var(--ssz-text-secondary)]">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
          {t('translate.step3.coverageCallout', {
            multi: totals.multiVariant,
            total: totals.withRef,
          })}
        </p>
      )}

      <TrTester exercise={exercise} />
    </div>
  );
}

interface GuardCardProps {
  exercise: Translate;
  item: Item;
  index: number;
  onChange: (next: Translate) => void;
}

/** The two lists of one sentence: what the answer must contain, and what it may not. */
function GuardCard({ exercise, item, index, onChange }: GuardCardProps) {
  const t = useTranslations('Authoring');

  return (
    <div className="rounded-lg border border-border bg-surface p-3">
      <p className="mb-2 flex items-baseline gap-2">
        <span className="text-xs font-semibold text-muted-foreground">
          {t('translate.step2.sentenceLabel', { index: index + 1 })}
        </span>
        <span className="text-sm" style={{ fontFamily: READING }}>
          {item.source}
        </span>
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        {GUARD_KINDS.map((kind) => (
          <GuardList key={kind} exercise={exercise} item={item} kind={kind} onChange={onChange} />
        ))}
      </div>
    </div>
  );
}

interface GuardListProps {
  exercise: Translate;
  item: Item;
  kind: GuardKind;
  onChange: (next: Translate) => void;
}

/**
 * One list of guards, each with the note shown when it fires.
 *
 * The note sits beside the text rather than behind a disclosure, because it is the half
 * that matters: `«har bodd»` on its own tells the student nothing they can act on, while
 * "the task trains the perfect tense" is the whole reason the guard exists.
 */
function GuardList({ exercise, item, kind, onChange }: GuardListProps) {
  const t = useTranslations('Authoring');
  const guards = item[kind] ?? [];

  return (
    <div className="flex flex-col gap-2">
      <p
        className={`flex items-center gap-1 text-xs font-medium ${
          kind === 'require' ? 'text-success-700' : 'text-error'
        }`}
      >
        {kind === 'require' ? (
          <CheckIcon className="size-3.5" aria-hidden />
        ) : (
          <Ban className="size-3.5" aria-hidden />
        )}
        {kind === 'require' ? t('translate.step3.requireLabel') : t('translate.step3.forbidLabel')}
      </p>

      {guards.map((guard, at) => (
        <div key={at} className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <Input
              value={guard.text}
              style={{ fontFamily: READING }}
              aria-label={
                kind === 'require'
                  ? t('translate.step3.requireText')
                  : t('translate.step3.forbidText')
              }
              placeholder={
                kind === 'require'
                  ? t('translate.step3.requirePlaceholder')
                  : t('translate.step3.forbidPlaceholder')
              }
              onChange={(event) =>
                onChange(setGuard(exercise, item.id, kind, at, { text: event.target.value }))
              }
            />
            <button
              type="button"
              aria-label={t('translate.step3.removeGuard')}
              title={t('translate.step3.removeGuard')}
              onClick={() => onChange(removeGuard(exercise, item.id, kind, at))}
              className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border hover:bg-[var(--ssz-bg-subtle)]"
            >
              <X className="size-3.5" aria-hidden />
            </button>
          </div>
          <Input
            value={guard.note ?? ''}
            aria-label={t('translate.step3.guardNote')}
            placeholder={t('translate.step3.guardNotePlaceholder')}
            onChange={(event) =>
              onChange(setGuard(exercise, item.id, kind, at, { note: event.target.value }))
            }
          />
        </div>
      ))}

      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="self-start"
        onClick={() => onChange(addGuard(exercise, item.id, kind))}
      >
        <Plus className="size-3.5" aria-hidden />
        {kind === 'require' ? t('translate.step3.addRequire') : t('translate.step3.addForbid')}
      </Button>
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

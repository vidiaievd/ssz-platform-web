'use client';

import { AlertTriangle, Plus, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  canAddBucket,
  canUseNone,
  issues,
  itemsIn,
  presetsFor,
  SB_MAX_BUCKETS,
  SB_MIN_BUCKETS,
  SB_NONE,
  stepState,
  type BucketPreset,
  type SortIntoBucketsContent,
} from '@/lib/shared-kernel/sort-into-buckets';

import { ReorderWithAnnouncer } from '../lesson-reorder';
import {
  addBucket,
  applyPreset,
  removeBucket,
  reorderBuckets,
  setBucket,
  setInstruction,
  setNoneLabel,
  setTitle,
  setUseNone,
} from './edits';
import { useIssueCopy } from './issue-copy';

export interface StepBucketsProps<T extends SortIntoBucketsContent> {
  exercise: T;
  onChange: (next: T) => void;
  /**
   * The course's language. Decides which starter sets are offered (kernel `presets.ts`):
   * none for a language with no pack, rather than a guess at one (AC-X7).
   */
  language: string;
}

/**
 * Step 1: the buckets — what the items are sorted into.
 *
 * Before the items for the reason `multiple_choice_group` puts its columns first: the
 * buckets are shared by every item, so an author who writes twelve items and then decides
 * there are three buckets instead of two has twelve answers to revisit. The starter sets
 * are what make the choice a click, and they come from the course language's pack — where
 * the language has none, the cards are not drawn and the refusal label is the author's to
 * write (AC-X7).
 *
 * Every message here is the kernel's. An untouched step draws none of them: the scaffold
 * carries blockers from the moment it exists, and a new exercise should not open onto red
 * (`stepState` is `empty` until something is written; the gate still refuses the document).
 */
export function StepBuckets<T extends SortIntoBucketsContent>({
  exercise,
  onChange,
  language,
}: StepBucketsProps<T>) {
  const t = useTranslations('Authoring.sortIntoBuckets');
  const describeIssue = useIssueCopy(exercise);

  const quiet = stepState(exercise, 1).s === 'empty';
  const found = quiet ? [] : issues(exercise).filter((issue) => issue.step === 1);
  const forBucket = (id: string) =>
    found.filter((issue) => 'bucketId' in issue && issue.bucketId === id);
  const general = found.filter((issue) => !('bucketId' in issue));

  const presets = presetsFor(language);
  const total = exercise.buckets.length + (exercise.useNone ? 1 : 0);
  const canAdd = canAddBucket(exercise);
  const canRemove = exercise.buckets.length > SB_MIN_BUCKETS;
  const inNone = itemsIn(exercise, SB_NONE).length;
  const noneBlocked = !canUseNone(exercise);
  const noneProblems = quiet ? [] : forBucket(SB_NONE);

  const pressed = (preset: BucketPreset) =>
    preset.buckets.length === exercise.buckets.length &&
    preset.buckets.every(([label], at) => exercise.buckets[at]?.label === label);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-base font-semibold">{t('step1.title')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t('step1.lede')}</p>
      </div>

      <section className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium" htmlFor="sb-title">
            {t('step1.titleLabel')}
          </label>
          <Input
            id="sb-title"
            aria-describedby="sb-title-help"
            value={exercise.title}
            placeholder={t('step1.titlePlaceholder')}
            onChange={(event) => onChange(setTitle(exercise, event.target.value))}
          />
          <p id="sb-title-help" className="text-xs text-muted-foreground">
            {t('step1.titleHelp')}
          </p>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium" htmlFor="sb-instruction">
            {t('step1.instructionLabel')}
          </label>
          <Input
            id="sb-instruction"
            aria-describedby="sb-instruction-help"
            style={{ fontFamily: 'var(--ssz-font-reading)' }}
            value={exercise.instruction}
            placeholder={t('step1.instructionPlaceholder')}
            onChange={(event) => onChange(setInstruction(exercise, event.target.value))}
          />
          <p id="sb-instruction-help" className="text-xs text-muted-foreground">
            {t('step1.instructionHelp')}
          </p>
        </div>
      </section>

      <section className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-sm font-semibold">{t('step1.bucketsTitle')}</h3>
          <p className="text-xs text-muted-foreground tabular-nums">
            {t('step1.bucketsCount', { count: total, max: SB_MAX_BUCKETS })}
          </p>
        </div>

        {presets.length > 0 && (
          <>
            <p className="text-xs font-medium text-muted-foreground">{t('step1.presetsTitle')}</p>
            {/* Pressed by comparing labels in order rather than by a stored id: an author who
                renamed a bucket has left the set, and a card that stayed pressed would be
                claiming otherwise. The cards carry the labels themselves — they are the pack's
                data, in the course's language, not words this UI has to translate. */}
            <ul className="grid gap-2 sm:grid-cols-2">
              {presets.map((preset) => {
                const active = pressed(preset);
                return (
                  <li key={preset.id}>
                    <button
                      type="button"
                      aria-pressed={active}
                      onClick={() => onChange(applyPreset(exercise, preset))}
                      className={`flex w-full flex-col gap-0.5 rounded-lg border p-3 text-left transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none ${
                        active
                          ? 'border-primary bg-[var(--ssz-bg-subtle)]'
                          : 'border-border hover:bg-[var(--ssz-bg-subtle)]'
                      }`}
                    >
                      <span
                        className="text-sm font-medium"
                        style={{ fontFamily: 'var(--ssz-font-reading)' }}
                      >
                        {preset.buckets.map(([label]) => label).join(' · ')}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
            <p className="text-xs text-muted-foreground">{t('step1.presetNote')}</p>
          </>
        )}

        <div className="flex items-center gap-2 pl-[52px] text-xs font-medium text-muted-foreground">
          <span className="flex-1">{t('step1.bucketHeader')}</span>
          <span className="flex-[2]">{t('step1.ruleHeader')}</span>
          <span className="w-9" />
        </div>

        <ReorderWithAnnouncer
          items={exercise.buckets.map((b) => ({ id: b.id, title: b.label }))}
          onReorder={(next) =>
            onChange(
              reorderBuckets(
                exercise,
                next.map((entry) => entry.id),
              ),
            )
          }
        >
          {(entry, position) => {
            const bucket = exercise.buckets.find((b) => b.id === entry.id);
            if (bucket === undefined) return null;
            const problems = forBucket(bucket.id);
            const invalid = problems.length > 0;

            return (
              <div className="flex flex-col gap-1 py-1">
                <div className="flex items-center gap-2">
                  <span
                    aria-hidden
                    className="grid size-6 shrink-0 place-items-center rounded-md bg-muted font-mono text-xs text-muted-foreground"
                  >
                    {position}
                  </span>
                  <Input
                    className="flex-1"
                    style={{ fontFamily: 'var(--ssz-font-reading)' }}
                    aria-label={t('step1.bucketAria', { index: position })}
                    value={bucket.label}
                    hasError={invalid}
                    aria-invalid={invalid}
                    onChange={(event) =>
                      onChange(setBucket(exercise, bucket.id, { label: event.target.value }))
                    }
                  />
                  <Input
                    className="flex-[2]"
                    aria-label={t('step1.ruleAria', { index: position })}
                    value={bucket.rule}
                    onChange={(event) =>
                      onChange(setBucket(exercise, bucket.id, { rule: event.target.value }))
                    }
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={!canRemove}
                    title={canRemove ? undefined : t('step1.removeFloor')}
                    aria-label={t('step1.removeBucket', { index: position })}
                    onClick={() => onChange(removeBucket(exercise, bucket.id))}
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </Button>
                </div>
                {problems.map((issue, at) => (
                  <p
                    key={`${issue.code}-${at}`}
                    className="flex items-start gap-1.5 pl-8 text-xs text-error"
                  >
                    <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                    {describeIssue(issue, { bare: true })}
                  </p>
                ))}
              </div>
            );
          }}
        </ReorderWithAnnouncer>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={!canAdd}
            onClick={() => onChange(addBucket(exercise))}
          >
            <Plus className="size-4" aria-hidden />
            {t('step1.addBucket')}
          </Button>
          {/* Said, not only greyed: a disabled button with no reason is a puzzle (AC-B2). */}
          {!canAdd && (
            <span role="note" className="text-xs text-muted-foreground">
              {t('step1.addCeiling')}
            </span>
          )}
        </div>

        {general.map((issue, at) => (
          <p
            key={`${issue.code}-${at}`}
            className="flex items-start gap-1.5 rounded-lg border border-error/40 px-3 py-2 text-xs text-error"
          >
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            {describeIssue(issue)}
          </p>
        ))}
      </section>

      <section className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            <label className="text-sm font-semibold" htmlFor="sb-none">
              {t('step1.noneTitle')}
            </label>
            <p className="text-xs text-muted-foreground">{t('step1.noneHelp')}</p>
          </div>
          <Switch
            id="sb-none"
            aria-label={t('step1.noneSwitch')}
            checked={exercise.useNone}
            disabled={noneBlocked}
            onCheckedChange={(on) => onChange(setUseNone(exercise, on))}
          />
        </div>
        {noneBlocked && (
          <p role="note" className="text-xs text-muted-foreground">
            {t('step1.noneCeiling')}
          </p>
        )}

        {exercise.useNone && (
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium" htmlFor="sb-none-label">
              {t('step1.noneLabelLabel')}
            </label>
            <Input
              id="sb-none-label"
              style={{ fontFamily: 'var(--ssz-font-reading)' }}
              value={exercise.noneLabel}
              placeholder={t('step1.noneLabelPlaceholder')}
              hasError={noneProblems.length > 0}
              aria-invalid={noneProblems.length > 0}
              onChange={(event) => onChange(setNoneLabel(exercise, event.target.value))}
            />
            {noneProblems.map((issue, at) => (
              <p
                key={`${issue.code}-${at}`}
                className="flex items-start gap-1.5 text-xs text-error"
              >
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                {describeIssue(issue, { bare: true })}
              </p>
            ))}
            {/* Switching it off unassigns, it does not delete (AC-B6) — and the author is
                told how much that is before doing it, not after. */}
            {inNone > 0 && (
              <p className="text-xs text-muted-foreground">
                {t('step1.noneItems', { count: inNone })}
              </p>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { AlertCircle, Info, Lock, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  completePairs,
  issues,
  rightItems,
  type MatchPairs,
  type Settings,
} from '@/lib/shared-kernel/match-pairs';

import { addDistractor, distractorProblem, removeDistractor, setSettings } from './edits';

/** The reading face, for the variant whose halves are sentences. */
const READING = 'var(--ssz-font-reading)';

export interface StepRightColumnProps {
  exercise: MatchPairs;
  onChange: (next: MatchPairs) => void;
  /** Takes the teacher back to step 1, where the answers are actually written. */
  onEditPairs?: () => void;
  disabled?: boolean;
}

/**
 * Step 2 of the match-pairs builder: the pool the student chooses from.
 *
 * Half of it is not authored at all — every complete pair's right half is already an
 * answer, so it is derived and locked, and the teacher never types an answer twice. The
 * work here is the extras: halves that look plausible and complete nothing. Without them
 * the pool equals the set of slots and the last match is free, which is the one thing
 * this step exists to prevent.
 */
export function StepRightColumn({
  exercise,
  onChange,
  onEditPairs,
  disabled = false,
}: StepRightColumnProps) {
  const t = useTranslations('Authoring');
  const [draft, setDraft] = useState('');

  const answers = completePairs(exercise);
  const pool = rightItems(exercise);
  const problems = issues(exercise);
  const reading = exercise.variant === 'halves' ? READING : undefined;

  const problem = distractorProblem(exercise, draft);
  const canAdd = draft.trim() !== '' && problem === null;

  function commitDraft() {
    if (!canAdd) return;
    onChange(addDistractor(exercise, draft));
    setDraft('');
  }

  const duplicate = problems.find((issue) => issue.code === 'POOL_DUPLICATE');

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-lg font-semibold">{t('matchPairs.step2.title')}</h2>
        <p className="mt-1 max-w-prose text-sm text-muted-foreground">
          {t('matchPairs.step2.lede')}
        </p>
      </div>

      <section className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">{t('matchPairs.step2.answersTitle')}</p>
            <p className="text-xs text-muted-foreground">{t('matchPairs.step2.answersHelp')}</p>
          </div>
          {onEditPairs && (
            <Button type="button" variant="ghost" size="sm" onClick={onEditPairs}>
              {t('matchPairs.step2.editPairs')}
            </Button>
          )}
        </div>

        {answers.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('matchPairs.step2.answersEmpty')}</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {answers.map((pair, index) => (
              <li
                key={pair.id}
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-[var(--ssz-bg-subtle)] px-2.5 py-1 text-sm"
                style={{ fontFamily: reading }}
              >
                <Lock className="size-3 text-muted-foreground" aria-hidden />
                <span className="text-[11px] font-semibold text-muted-foreground">{index + 1}</span>
                {pair.right}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
        <div>
          <p className="text-sm font-medium">{t('matchPairs.step2.extrasTitle')}</p>
          <p className="text-xs text-muted-foreground">{t('matchPairs.step2.extrasHelp')}</p>
        </div>

        <div className="flex items-start gap-2">
          <div className="flex-1">
            <Input
              value={draft}
              disabled={disabled}
              hasError={problem !== null}
              aria-invalid={problem !== null}
              aria-label={t('matchPairs.step2.extrasTitle')}
              placeholder={t('matchPairs.step2.extraPlaceholder')}
              style={{ fontFamily: reading }}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== 'Enter') return;
                event.preventDefault();
                commitDraft();
              }}
            />
            {problem !== null && (
              <p role="alert" className="mt-1 flex items-center gap-1.5 text-xs text-error">
                <AlertCircle className="size-3.5" aria-hidden />
                {problem === 'answer'
                  ? t('matchPairs.step2.extraIsAnswer')
                  : t('matchPairs.step2.extraExists')}
              </p>
            )}
          </div>
          <Button type="button" disabled={disabled || !canAdd} onClick={commitDraft}>
            {t('matchPairs.step2.addExtra')}
          </Button>
        </div>

        {exercise.distractors.length === 0 ? (
          <div className="rounded-md border border-dashed border-border px-4 py-6 text-center">
            <p className="text-sm font-medium">{t('matchPairs.step2.extrasEmptyTitle')}</p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
              {t('matchPairs.step2.extrasEmptyBody')}
            </p>
          </div>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {exercise.distractors.map((distractor) => (
              <li
                key={distractor.id}
                className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-sm"
                style={{ fontFamily: reading }}
              >
                {distractor.text}
                <Button
                  type="button"
                  variant="link"
                  size="icon-sm"
                  disabled={disabled}
                  aria-label={t('matchPairs.step2.removeExtra', { text: distractor.text })}
                  onClick={() => onChange(removeDistractor(exercise, distractor.id))}
                >
                  <X className="size-3.5" aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
        )}

        {duplicate?.code === 'POOL_DUPLICATE' && (
          <p role="alert" className="flex items-start gap-1.5 text-xs text-error">
            <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            {t('matchPairs.step2.poolDuplicate', { text: duplicate.text })}
          </p>
        )}
      </section>

      <section className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
        <p className="text-sm font-medium">{t('matchPairs.step2.behaviourTitle')}</p>

        <ToggleRow
          label={t('matchPairs.step2.useExtras')}
          help={t('matchPairs.step2.useExtrasHelp')}
          checked={exercise.settings.distractors}
          disabled={disabled}
          onChange={(distractors) => onChange(setSettings(exercise, { distractors }))}
        />
        <ToggleRow
          label={t('matchPairs.step2.shuffle')}
          help={t('matchPairs.step2.shuffleHelp')}
          checked={exercise.settings.shuffle}
          disabled={disabled}
          onChange={(shuffle) => onChange(setSettings(exercise, { shuffle }))}
        />
        <ToggleRow
          label={t('matchPairs.step2.showRemaining')}
          help={t('matchPairs.step2.showRemainingHelp')}
          checked={exercise.settings.showRemaining}
          disabled={disabled}
          onChange={(showRemaining) => onChange(setSettings(exercise, { showRemaining }))}
        />

        {/* Fixed, not configurable (BEHAVIOR §1.3) — said out loud so nobody hunts for it. */}
        <div className="flex items-start gap-2 rounded-md bg-[var(--ssz-bg-subtle)] px-3 py-2">
          <Lock className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden />
          <div>
            <p className="text-sm">{t('matchPairs.step2.checkingLocked')}</p>
            <p className="text-xs text-muted-foreground">
              {t('matchPairs.step2.checkingLockedHelp')}
            </p>
          </div>
        </div>
      </section>

      {answers.length > 0 && (
        <PoolCallout exercise={exercise} poolSize={pool.length} slotCount={answers.length} />
      )}
    </div>
  );
}

interface ToggleRowProps {
  label: string;
  help: string;
  checked: boolean;
  disabled: boolean;
  onChange: (checked: boolean) => void;
}

function ToggleRow({ label, help, checked, disabled, onChange }: ToggleRowProps) {
  return (
    <label className="flex items-start justify-between gap-4">
      <span>
        <span className="block text-sm">{label}</span>
        <span className="block text-xs text-muted-foreground">{help}</span>
      </span>
      <Switch checked={checked} disabled={disabled} onCheckedChange={onChange} />
    </label>
  );
}

interface PoolCalloutProps {
  exercise: MatchPairs;
  poolSize: number;
  slotCount: number;
}

/**
 * How much choice the student really has, in the counts as they stand right now
 * (AC-B15), and the two ways that geometry goes wrong.
 *
 * Amber is the kernel's own judgement, not a second opinion: `POOL_NO_DISTRACTORS` when
 * the extras are on and none are written, `POOL_TOO_SMALL` when they are off and there
 * are too few pairs for elimination to be work. Both end the same way — the final match
 * is free — which is why the callout says so rather than naming the rule.
 */
function PoolCallout({ exercise, poolSize, slotCount }: PoolCalloutProps) {
  const t = useTranslations('Authoring');
  const problems = issues(exercise);
  const noExtras = problems.some((issue) => issue.code === 'POOL_NO_DISTRACTORS');
  const tooSmall = problems.some((issue) => issue.code === 'POOL_TOO_SMALL');
  const warn = noExtras || tooSmall;

  return (
    <div
      className={`flex items-start gap-2 rounded-md border px-4 py-3 text-sm ${
        warn
          ? 'border-warning-300 bg-warning-50 text-warning-700'
          : 'border-border bg-[var(--ssz-bg-subtle)] text-[var(--ssz-text-secondary)]'
      }`}
      role="status"
    >
      <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
      <p>
        {t('matchPairs.step2.poolCounts', { pool: poolSize, slots: slotCount })}{' '}
        {noExtras
          ? t('matchPairs.step2.poolGiveaway')
          : tooSmall
            ? t('matchPairs.step2.poolTooSmall')
            : t('matchPairs.step2.poolOk')}
      </p>
    </div>
  );
}

/** Re-exported so a caller can name the settings it is toggling without a kernel import. */
export type PoolSettings = Settings;

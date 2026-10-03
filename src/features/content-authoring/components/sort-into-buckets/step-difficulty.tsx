'use client';

import { AlertTriangle } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Segmented } from '@/components/ui/segmented';
import type { AudioDraft } from '@/lib/shared-kernel/audio';
import {
  issues,
  passMark,
  readyItems,
  type Attempts,
  type SortIntoBucketsContent,
} from '@/lib/shared-kernel/sort-into-buckets';

import { AudioEnableRow, AudioModeRow, AudioRulesCard, AudioSourceCard } from '../audio';
import { ToggleRow } from '../toggle-row';
import { useIssueCopy } from './issue-copy';
import { setSettings } from './edits';

export interface StepDifficultyProps<T extends SortIntoBucketsContent> {
  exercise: T;
  onChange: (next: T) => void;
  audio: AudioDraft;
  onAudioChange: (next: AudioDraft) => void;
}

/**
 * Step 4: how much help, and how the task is delivered.
 *
 * Nothing here touches the buckets or the items (AC-D4) — every control goes through
 * `setSettings`, which rewrites `settings` and nothing else. Two contradictions are said
 * beside the switch that causes them and not only in the gate: counting what is left with
 * no refusal bucket (AC-D1), and one check with the key shown. Both are warnings. So is the
 * lowered evidence ceiling (AC-D1, plan 66 phase 9): it sits under the counter, its usual
 * cause, and names a skewed board too, which lowers the ceiling as well.
 *
 * The audio layer's enable row and source live here (the spec's step 4); the per-item row
 * is in step 2, where the item is.
 */
export function StepDifficulty<T extends SortIntoBucketsContent>({
  exercise,
  onChange,
  audio,
  onAudioChange,
}: StepDifficultyProps<T>) {
  const t = useTranslations('Authoring.sortIntoBuckets');
  const describeIssue = useIssueCopy(exercise);
  const s = exercise.settings;

  const notes = issues(exercise).filter((issue) => issue.step === 4);
  const noteFor = (code: string) => notes.find((issue) => issue.code === code);
  // Against the items a student is dealt, so the number is the one that will be played.
  const total = Math.max(readyItems(exercise).length, 1);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-base font-semibold">{t('step4.title')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t('step4.lede')}</p>
      </div>

      <section className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4">
        <ToggleRow
          label={t('step4.shuffleLabel')}
          help={t('step4.shuffleHelp')}
          checked={s.shuffle}
          onChange={(shuffle) => onChange(setSettings(exercise, { shuffle }))}
        />
        <div className="flex flex-col gap-1.5">
          <ToggleRow
            label={t('step4.counterLabel')}
            help={t('step4.counterHelp')}
            checked={s.showRemaining}
            onChange={(showRemaining) => onChange(setSettings(exercise, { showRemaining }))}
          />
          <Note issue={noteFor('SB_COUNTER_ARITHMETIC')} describe={describeIssue} />
          <Note issue={noteFor('SB_CEILING_LOWERED')} describe={describeIssue} />
        </div>
        <ToggleRow
          label={t('step4.hintsLabel')}
          help={t('step4.hintsHelp')}
          checked={s.hints}
          onChange={(hints) => onChange(setSettings(exercise, { hints }))}
        />
        <ToggleRow
          label={t('step4.revealLabel')}
          help={t('step4.revealHelp')}
          checked={s.revealKey}
          onChange={(revealKey) => onChange(setSettings(exercise, { revealKey }))}
        />
      </section>

      <section className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4">
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium">{t('step4.attemptsLabel')}</span>
          <Segmented<string>
            value={String(s.attempts)}
            aria-label={t('step4.attemptsLabel')}
            onValueChange={(value) =>
              onChange(setSettings(exercise, { attempts: Number(value) as Attempts }))
            }
            options={[
              { value: '0', label: t('step4.attemptsUnlimited') },
              { value: '1', label: '1' },
              { value: '2', label: '2' },
              { value: '3', label: '3' },
            ]}
            className="self-start"
          />
          <p className="text-xs text-muted-foreground">{t('step4.attemptsHelp')}</p>
          <Note issue={noteFor('SB_ONE_SHOT_KEY')} describe={describeIssue} />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium" htmlFor="sb-threshold">
            {t('step4.passLabel', { threshold: s.threshold })}
          </label>
          <input
            id="sb-threshold"
            type="range"
            min={0}
            max={100}
            step={5}
            value={s.threshold}
            aria-describedby="sb-threshold-help"
            onChange={(event) =>
              onChange(setSettings(exercise, { threshold: Number(event.target.value) }))
            }
          />
          {/* The percent restated in items, because that is the number an author can judge
              (AC-D2): 70% of nine is seven, and the difference between six and seven is
              the decision. */}
          <p id="sb-threshold-help" className="text-xs text-muted-foreground">
            {t('step4.passHelp', { mark: passMark(s, total), total })}
          </p>
        </div>
      </section>

      <section className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4">
        <AudioEnableRow draft={audio} onChange={onAudioChange} />
        {audio.audio.enabled && (
          <AudioModeRow
            draft={audio}
            onChange={onAudioChange}
            itemNoun={t('step4.audioItemNoun')}
          />
        )}
      </section>
      {audio.audio.enabled && (
        <>
          {audio.audio.source !== 'items' && (
            <AudioSourceCard draft={audio} onChange={onAudioChange} />
          )}
          <AudioRulesCard
            draft={audio}
            onChange={onAudioChange}
            itemNoun={t('step4.audioItemNoun')}
          />
        </>
      )}
    </div>
  );
}

function Note({
  issue,
  describe,
}: {
  issue: ReturnType<typeof issues>[number] | undefined;
  describe: ReturnType<typeof useIssueCopy>;
}) {
  if (issue === undefined) return null;
  return (
    <p className="flex items-start gap-1.5 text-xs text-warning-700">
      <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
      {describe(issue)}
    </p>
  );
}

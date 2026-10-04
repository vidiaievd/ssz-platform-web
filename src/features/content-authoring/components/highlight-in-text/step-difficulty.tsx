'use client';

import { AlertTriangle, Info, Target } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Segmented } from '@/components/ui/segmented';
import type { AudioDraft } from '@/lib/shared-kernel/audio';
import {
  issues,
  passMark,
  PENALTY_WEIGHT,
  readyQuestions,
  type Attempts,
  type HighlightInTextContent,
  type Issue,
  type Penalty,
} from '@/lib/shared-kernel/highlight-in-text';

import { AudioEnableRow, AudioRulesCard, AudioSourceCard, AudioTranscriptCard } from '../audio';
import { ToggleRow } from '../toggle-row';
import { setSettings } from './edits';
import { useIssueCopy } from './issue-copy';
import { Card, StepHead } from './parts';

export interface StepDifficultyProps<T extends HighlightInTextContent> {
  exercise: T;
  onChange: (next: T) => void;
  audio: AudioDraft;
  onAudioChange: (next: AudioDraft) => void;
}

/** «Finding all but two and adding three wrong» — the prototype's worked example. */
const EXAMPLE_MISSED = 2;
const EXAMPLE_EXTRA = 3;

/**
 * Step 4: difficulty and delivery (plan 67 §7.5, BEHAVIOR §5).
 *
 * Nothing here touches the text, the questions or the key — every control goes through
 * `setSettings`. The penalty is the one dial that decides whether the exercise measures
 * anything, so its card leads, with a worked example on the first ready question, and `None`
 * is said at error level: marking everything passes and the evidence is capped
 * (`HT_PENALTY_OFF`). The other two ceiling and contradiction warnings sit under the control
 * that causes them. The axes card is the shared one under the builder (deviation 6).
 *
 * The audio layer is one clip over the whole passage: no per-item mode and no per-item
 * timecodes, because the passage has no items to time (plan 67 phase 7 p. 2).
 */
export function StepDifficulty<T extends HighlightInTextContent>({
  exercise,
  onChange,
  audio,
  onAudioChange,
}: StepDifficultyProps<T>) {
  const t = useTranslations('Authoring.highlightInText.step4');
  const copy = useIssueCopy(exercise);
  const s = exercise.settings;

  const notes = issues(exercise).filter((issue) => issue.step === 4);
  const noteFor = (code: Issue['code']) => notes.find((issue) => issue.code === code);

  const first = readyQuestions(exercise)[0];
  const n = first?.spans.length ?? 0;
  const example =
    first === undefined
      ? null
      : Math.max(
          0,
          Math.round(((n - EXAMPLE_MISSED - PENALTY_WEIGHT[s.penalty] * EXAMPLE_EXTRA) / n) * 100),
        );
  const penaltyOff = noteFor('HT_PENALTY_OFF');

  return (
    <div className="flex flex-col gap-5">
      <StepHead eyebrow={t('eyebrow')} title={t('title')} lede={t('lede')} />

      <Card icon={Target} title={t('penaltyTitle')} labelledBy="ht-penalty-title">
        <Segmented<Penalty>
          aria-label={t('penaltyTitle')}
          size="sm"
          className="self-start"
          value={s.penalty}
          onValueChange={(penalty) => onChange(setSettings(exercise, { penalty }))}
          options={[
            { value: 'off', label: t('penalty.off') },
            { value: 'half', label: t('penalty.half') },
            { value: 'full', label: t('penalty.full') },
          ]}
        />
        {penaltyOff !== undefined ? (
          <p
            role="alert"
            className="m-0 flex items-start gap-[5px] text-xs text-(--ssz-color-error-700)"
          >
            <AlertTriangle size={13} aria-hidden="true" className="mt-px shrink-0" />
            {copy.describe(penaltyOff)}
          </p>
        ) : (
          <p className="m-0 flex items-start gap-[5px] text-xs text-(--ssz-text-muted)">
            <Info size={13} aria-hidden="true" className="mt-px shrink-0" />
            {first !== undefined && example !== null
              ? t('penaltyExample', {
                  count: n,
                  prompt: clip(first.prompt.trim()),
                  score: example,
                })
              : t('penaltyGeneric')}
          </p>
        )}
        <p className="m-0 text-xs text-(--ssz-text-muted)">{t('near')}</p>
      </Card>

      <Card>
        <div className="flex flex-col gap-1.5">
          <ToggleRow
            label={t('countLabel')}
            help={t('countHelp')}
            checked={s.showCount}
            onChange={(showCount) => onChange(setSettings(exercise, { showCount }))}
          />
          <Note issue={noteFor('HT_COUNT_SHOWN')} describe={copy.describe} />
        </div>
        <ToggleRow
          label={t('hintsLabel')}
          help={t('hintsHelp')}
          checked={s.hints}
          onChange={(hints) => onChange(setSettings(exercise, { hints }))}
        />
        <ToggleRow
          label={t('revealLabel')}
          help={t('revealHelp')}
          checked={s.revealKey}
          onChange={(revealKey) => onChange(setSettings(exercise, { revealKey }))}
        />
      </Card>

      <Card>
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold tracking-wide text-(--ssz-text-secondary)">
            {t('attemptsLabel')}
          </span>
          <Segmented<string>
            aria-label={t('attemptsLabel')}
            size="sm"
            className="self-start"
            value={String(s.attempts)}
            onValueChange={(value) =>
              onChange(setSettings(exercise, { attempts: Number(value) as Attempts }))
            }
            options={[
              { value: '0', label: t('attemptsUnlimited') },
              { value: '1', label: '1' },
              { value: '2', label: '2' },
              { value: '3', label: '3' },
            ]}
          />
          <p className="m-0 text-xs text-(--ssz-text-muted)">{t('attemptsHelp')}</p>
          <Note issue={noteFor('HT_ONE_SHOT_REVEAL')} describe={copy.describe} />
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            className="text-xs font-semibold tracking-wide text-(--ssz-text-secondary)"
            htmlFor="ht-threshold"
          >
            {t('passLabel', { threshold: s.threshold })}
          </label>
          <input
            id="ht-threshold"
            type="range"
            min={50}
            max={100}
            step={5}
            value={s.threshold}
            {...(first !== undefined ? { 'aria-describedby': 'ht-threshold-help' } : {})}
            onChange={(event) =>
              onChange(setSettings(exercise, { threshold: Number(event.target.value) }))
            }
          />
          {/* The percent restated in marks, because that is the number an author can judge. */}
          {first !== undefined && (
            <p id="ht-threshold-help" className="m-0 text-xs text-(--ssz-text-muted)">
              {t('passHelp', { mark: passMark(s, n), total: n })}
            </p>
          )}
        </div>
      </Card>

      <Card>
        <AudioEnableRow draft={audio} onChange={onAudioChange} />
        {!audio.audio.enabled && (
          <p className="m-0 text-xs text-(--ssz-text-muted)">{t('audioOff')}</p>
        )}
      </Card>
      {audio.audio.enabled && (
        <>
          <AudioSourceCard draft={audio} onChange={onAudioChange} />
          <AudioRulesCard
            draft={audio}
            onChange={onAudioChange}
            itemNoun={t('audioItemNoun')}
            segments={false}
          />
          <AudioTranscriptCard draft={audio} onChange={onAudioChange} />
        </>
      )}
    </div>
  );
}

/** The prompt as the example quotes it — a reminder of which question, not the question. */
function clip(prompt: string): string {
  return prompt.length > 32 ? `${prompt.slice(0, 32)}…` : prompt;
}

function Note({
  issue,
  describe,
}: {
  issue: Issue | undefined;
  describe: (issue: Issue) => string;
}) {
  if (issue === undefined) return null;
  return (
    <p className="m-0 flex items-start gap-1.5 text-xs text-(--ssz-color-warning-700)">
      <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
      {describe(issue)}
    </p>
  );
}

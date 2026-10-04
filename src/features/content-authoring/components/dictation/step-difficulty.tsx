'use client';

import { AlertTriangle, FileText } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Segmented } from '@/components/ui/segmented';
import {
  ceilingCause,
  issues,
  passMark,
  readySegments,
  wordCount,
  type Attempts,
  type DictationContent,
  type Issue,
} from '@/lib/shared-kernel/dictation';

import { AudioRulesCard } from '../audio';
import { Callout, Card, StepHead } from '../highlight-in-text/parts';
import { ToggleRow } from '../toggle-row';
import { audioDraftOf, setSettings, setTranscriptWhen, withAudioDraft } from './edits';
import { useIssueCopy } from './issue-copy';

type Policy = DictationContent['audio']['settings']['transcriptWhen'];

export interface StepDifficultyProps<T extends DictationContent> {
  exercise: T;
  onChange: (next: T) => void;
}

/**
 * Step 4: dials and delivery (plan 68 §7.6).
 *
 * Nothing here touches the key. The audio layer's rules card is the shared one, with the
 * per-sentence timecode switch only while the dictation is by sentence. The transcript card
 * is this type's own: the key *is* the transcript, so there is no text to write — only who
 * may read it, and «always» is said at error level (AC-B9). The last line says whether the
 * evidence is capped and why (AC-B11), from the same rule the engine applies.
 */
export function StepDifficulty<T extends DictationContent>({
  exercise,
  onChange,
}: StepDifficultyProps<T>) {
  const t = useTranslations('Authoring.dictation.step4');
  const copy = useIssueCopy(exercise);
  const s = exercise.settings;
  const policy = exercise.audio.settings.transcriptWhen;

  const notes = issues(exercise).filter((issue) => issue.step === 4);
  const noteFor = (code: Issue['code']) => notes.find((issue) => issue.code === code);

  const first = readySegments(exercise)[0];
  const words = first === undefined ? 0 : wordCount(first.text);
  const cause = ceilingCause(exercise);
  const transcriptNote = noteFor('DICT_TRANSCRIPT_ALWAYS');

  const policyHelp =
    policy === 'always'
      ? t('transcript.alwaysHelp')
      : policy === 'after'
        ? t('transcript.afterHelp')
        : t('transcript.neverHelp');

  return (
    <div className="flex flex-col gap-5">
      <StepHead eyebrow={t('eyebrow')} title={t('title')} lede={t('lede')} />

      <AudioRulesCard
        draft={audioDraftOf(exercise)}
        onChange={(next) => onChange(withAudioDraft(exercise, next))}
        itemNoun={t('itemNoun')}
        segments={exercise.mode === 'segments'}
      />

      <Card icon={FileText} title={t('transcript.title')} labelledBy="dc-transcript-title">
        <Segmented<Policy>
          aria-label={t('transcript.title')}
          size="sm"
          className="self-start"
          value={policy}
          onValueChange={(next) => onChange(setTranscriptWhen(exercise, next))}
          options={[
            { value: 'never', label: t('transcript.never') },
            { value: 'after', label: t('transcript.after') },
            { value: 'always', label: t('transcript.always') },
          ]}
        />
        {transcriptNote !== undefined ? (
          <p
            role="alert"
            className="m-0 flex items-start gap-[5px] text-xs text-(--ssz-color-error-700)"
          >
            <AlertTriangle size={13} aria-hidden="true" className="mt-px shrink-0" />
            {copy.describe(transcriptNote)}
          </p>
        ) : (
          <p className="m-0 text-xs text-(--ssz-text-muted)">{policyHelp}</p>
        )}
      </Card>

      <Card>
        <ToggleRow
          label={t('countLabel')}
          help={t('countHelp')}
          checked={s.showWordCount}
          onChange={(showWordCount) => onChange(setSettings(exercise, { showWordCount }))}
        />
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
          <span
            id="dc-attempts-label"
            className="text-xs font-semibold tracking-wide text-(--ssz-text-secondary)"
          >
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
          <Note issue={noteFor('DICT_NO_RETRY_NO_KEY')} describe={copy.describe} />
          <Note issue={noteFor('DICT_ONE_PLAY_MANY_SEGMENTS')} describe={copy.describe} />
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            className="text-xs font-semibold tracking-wide text-(--ssz-text-secondary)"
            htmlFor="dc-threshold"
          >
            {t('passLabel', { threshold: s.threshold })}
          </label>
          <input
            id="dc-threshold"
            type="range"
            min={50}
            max={100}
            step={5}
            value={s.threshold}
            aria-describedby="dc-threshold-help"
            onChange={(event) =>
              onChange(setSettings(exercise, { threshold: Number(event.target.value) }))
            }
          />
          <p id="dc-threshold-help" className="m-0 text-xs text-(--ssz-text-muted)">
            {first !== undefined && words > 0
              ? t('passHelp', { mark: passMark(s, words), total: words })
              : t('passHelpEmpty')}
          </p>
          {s.threshold === 100 && (
            <p className="m-0 text-xs text-(--ssz-text-muted)">{t('passStrict')}</p>
          )}
        </div>
      </Card>

      <Callout tone={cause === null ? 'info' : 'warn'}>
        <span data-testid="dc-ceiling" data-cause={cause ?? 'none'}>
          {cause === null
            ? t('ceiling.none')
            : cause === 'count'
              ? t('ceiling.count')
              : cause === 'transcript'
                ? t('ceiling.transcript')
                : t('ceiling.both')}
        </span>
      </Callout>
    </div>
  );
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

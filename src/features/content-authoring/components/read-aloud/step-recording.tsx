'use client';

import { Target } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Input } from '@/components/ui/input';
import { Segmented } from '@/components/ui/segmented';
import {
  bytesFor,
  formatSeconds,
  issues,
  LIMITS,
  RA_MAX_PREP_SECONDS,
  readSeconds,
  type IssueContext,
} from '@/lib/shared-kernel/read-aloud';

import { Notes, type Note } from '../dictation/notes';
import { Callout, Card, Field, StepHead } from '../highlight-in-text/parts';
import { ToggleRow } from '../toggle-row';
import { setRecording, setSeconds, type ReadAloudDocument } from './edits';
import { useIssueCopy } from './issue-copy';

const MONO = { fontFamily: 'var(--ssz-font-mono)' } as const;
const TAKES = ['1', '2', '3'] as const;

export interface StepRecordingProps {
  exercise: ReadAloudDocument;
  onChange: (next: ReadAloudDocument) => void;
}

const kb = (seconds: number) => Math.round(bytesFor(seconds) / 1024);

/**
 * Step 4: the dials that decide how forgiving the microphone is (plan 70 §7.5) — takes, the
 * five switches, and the three lengths of each prompt.
 *
 * Kept apart from the content on purpose, and every number here is also a limit on what the
 * upload and the queue have to carry: the envelope line at the foot says what one student can
 * send at most. The ceiling itself is the kernel's (`LIMITS`), read by the media service and the
 * engine from the same place; this step only states it and checks the author's numbers against
 * it (`RA_OVER_CEILING`, `RA_RANGE_INVALID`).
 */
export function StepRecording({ exercise, onChange }: StepRecordingProps) {
  const t = useTranslations('Authoring.readAloud.step4');
  const copy = useIssueCopy(exercise);
  const r = exercise.recording;
  const ctx: IssueContext = { audio: exercise.audio.audio.enabled };
  const own = issues(exercise, ctx).filter((i) => i.step === 4);

  const noteOf = (issue: (typeof own)[number], index: number): Note => ({
    key: `${issue.code}-${index}`,
    level: issue.level === 'blocker' ? 'blocker' : issue.level === 'warning' ? 'warning' : 'info',
    text: copy.describe(issue),
  });

  const general: Note[] = own.flatMap((issue, i) =>
    'promptId' in issue ? [] : [noteOf(issue, i)],
  );
  const worst =
    exercise.prompts.reduce((n, p) => n + p.maxSeconds, 0) * (r.keepAllTakes ? r.takes : 1);

  return (
    <div className="flex flex-col gap-5">
      <StepHead eyebrow={t('eyebrow')} title={t('title')} lede={t('lede')} />

      <Card>
        <Field label={t('takesLabel')}>
          <Segmented
            aria-label={t('takesLabel')}
            value={String(r.takes) as (typeof TAKES)[number]}
            onValueChange={(value) => onChange(setRecording(exercise, { takes: Number(value) }))}
            options={TAKES.map((value) => ({ value, label: value }))}
          />
        </Field>
        <ToggleRow
          label={t('chooseBest.label')}
          help={t('chooseBest.help')}
          checked={r.chooseBest}
          onChange={(chooseBest) => onChange(setRecording(exercise, { chooseBest }))}
        />
        <ToggleRow
          label={t('listenBack.label')}
          help={t('listenBack.help')}
          checked={r.listenBack}
          onChange={(listenBack) => onChange(setRecording(exercise, { listenBack }))}
        />
        <ToggleRow
          label={t('countdown.label')}
          help={t('countdown.help')}
          checked={r.countdown}
          onChange={(countdown) => onChange(setRecording(exercise, { countdown }))}
        />
        <ToggleRow
          label={t('micCheck.label')}
          help={t('micCheck.help')}
          checked={r.micCheck}
          onChange={(micCheck) => onChange(setRecording(exercise, { micCheck }))}
        />
        <ToggleRow
          label={t('keepAll.label')}
          help={t('keepAll.help')}
          checked={r.keepAllTakes}
          onChange={(keepAllTakes) => onChange(setRecording(exercise, { keepAllTakes }))}
        />
        <Notes notes={general} />
      </Card>

      <Card icon={Target} title={t('lengthTitle')}>
        {exercise.prompts.map((prompt, i) => {
          const label = prompt.label.trim() === '' ? t('promptN', { index: i + 1 }) : prompt.label;
          const notes = own.flatMap((issue, at) =>
            'promptId' in issue && issue.promptId === prompt.id ? [noteOf(issue, at)] : [],
          );
          return (
            <div key={prompt.id} role="group" aria-label={label} className="flex flex-col gap-1.5">
              <div className="flex flex-wrap items-end gap-3">
                <span
                  aria-hidden="true"
                  className="mb-2 grid size-5 shrink-0 place-items-center rounded-full bg-(--ssz-bg-muted) text-[11px] font-bold text-(--ssz-text-secondary)"
                >
                  {i + 1}
                </span>
                <Field label={t('prep')} htmlFor={`ra-prep-${prompt.id}`}>
                  <Input
                    id={`ra-prep-${prompt.id}`}
                    type="number"
                    min={0}
                    max={RA_MAX_PREP_SECONDS}
                    className="w-[74px]"
                    value={prompt.prepSeconds}
                    onChange={(event) =>
                      onChange(
                        setSeconds(exercise, prompt.id, 'prepSeconds', Number(event.target.value)),
                      )
                    }
                  />
                </Field>
                <Field label={t('min')} htmlFor={`ra-min-${prompt.id}`}>
                  <Input
                    id={`ra-min-${prompt.id}`}
                    type="number"
                    min={0}
                    className="w-[74px]"
                    value={prompt.minSeconds}
                    onChange={(event) =>
                      onChange(
                        setSeconds(exercise, prompt.id, 'minSeconds', Number(event.target.value)),
                      )
                    }
                  />
                </Field>
                <Field label={t('max')} htmlFor={`ra-max-${prompt.id}`}>
                  <Input
                    id={`ra-max-${prompt.id}`}
                    type="number"
                    min={1}
                    className="w-[74px]"
                    value={prompt.maxSeconds}
                    onChange={(event) =>
                      onChange(
                        setSeconds(exercise, prompt.id, 'maxSeconds', Number(event.target.value)),
                      )
                    }
                  />
                </Field>
                <p
                  className="m-0 flex flex-wrap gap-x-3 pb-[9px] text-xs text-(--ssz-text-muted)"
                  style={{ fontVariantNumeric: 'tabular-nums' }}
                >
                  {exercise.mode === 'read' && prompt.text.trim() !== '' && (
                    <span>
                      {t.rich('readsIn', {
                        time: formatSeconds(readSeconds(prompt.text)),
                        b: (chunks) => <b className="text-(--ssz-text-secondary)">{chunks}</b>,
                      })}
                    </span>
                  )}
                  <span>
                    {t.rich('ceilingSize', {
                      size: kb(prompt.maxSeconds),
                      b: (chunks) => <b className="text-(--ssz-text-secondary)">{chunks}</b>,
                    })}
                  </span>
                </p>
              </div>
              <Notes notes={notes} />
            </div>
          );
        })}

        <Callout tone="info">
          {t.rich('envelope', {
            mime: LIMITS.mime,
            ceiling: formatSeconds(LIMITS.hardMaxSeconds),
            mb: Math.round(LIMITS.maxBytes / 1024 / 1024),
            size: kb(worst),
            b: (chunks) => <b>{chunks}</b>,
            kind: (chunks) => <b style={MONO}>{chunks}</b>,
          })}
        </Callout>
      </Card>
    </div>
  );
}

'use client';

import { Bot, ExternalLink, Mic, User } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useId, useState } from 'react';

import { Input } from '@/components/ui/input';
import { Segmented } from '@/components/ui/segmented';
import { wsHref } from '@/features/workspaces/lib/href';
import { useWorkspaceRef } from '@/features/workspaces/lib/use-workspace-ref';
import { Link } from '@/lib/i18n/navigation';
import {
  clampPassPercent,
  machineCanCheck,
  MAX_READING_PASS_PERCENT,
  MIN_READING_PASS_PERCENT,
  REVISIONS,
  TEMPLATE_CODE,
} from '@/lib/shared-kernel/read-aloud';

import { Card, Field, StepHead } from '../highlight-in-text/parts';
import { PipelineStage } from '../pipeline-stage';
import { ToggleRow } from '../toggle-row';
import { setAi, setReview, setSettings, type ReadAloudDocument } from './edits';

export interface StepFlowProps {
  exercise: ReadAloudDocument;
  /** The course this exercise lives in — what the queue link filters on. */
  containerId: string;
  onChange: (next: ReadAloudDocument) => void;
}

/**
 * Step 5: what happens to the recording after it is sent (plan 70 §7.6, plan 82 step 11c).
 *
 * The pipeline is the point of the step: Opptak, AI-forsjekk, Lærer. In a school a recording
 * ends at a person; a learner without a teacher gets the machine's verdict, and only on a reading
 * of a given text (plan 82, Q7). So the machine's switches exist only in `read` mode — elsewhere
 * the stage says why it is off, and a switch left on from an earlier mode can still be turned off.
 * The stage is tagged on only when the engine would actually check (`machineCanCheck`), so a
 * switch that leaves the machine nothing to decide never reads as live.
 *
 * `ai.draft` and `aiVisibility` stay in the document and are not offered: nothing reads them for
 * this template, and the learner sees the machine's check whenever there is one (step 11a).
 *
 * There is no queue on this screen. The handoff drew one here; deviation 10 keeps the single
 * queue the platform already has, and this step links into it.
 */
export function StepFlow({ exercise, containerId, onChange }: StepFlowProps) {
  const t = useTranslations('Authoring.readAloud');
  const v = exercise.review;
  const reading = exercise.mode === 'read';
  const live = machineCanCheck(exercise);
  const readOnly = t('step5.aiStage.readOnly', { mode: t('modes.read.label') });

  return (
    <div className="flex flex-col gap-5">
      <StepHead eyebrow={t('step5.eyebrow')} title={t('step5.title')} lede={t('step5.lede')} />

      <section className="grid gap-3 sm:grid-cols-3" aria-label={t('step5.pipeline')}>
        <PipelineStage
          icon={Mic}
          when={t('step5.stage.nowWhen')}
          title={t('step5.stage.now')}
          body={t('step5.stage.nowBody')}
          tag={t('step5.stage.nowTag')}
        />
        <PipelineStage
          icon={Bot}
          off={!live}
          when={t('step5.stage.aiWhen')}
          title={t('step5.stage.ai')}
          body={t('step5.stage.aiBody')}
          tag={live ? t('step5.stage.aiOn') : t('step5.stage.aiOff')}
        />
        <PipelineStage
          icon={User}
          when={t('step5.stage.teacherWhen')}
          title={t('step5.stage.teacher')}
          body={t('step5.stage.teacherBody')}
          tag={t('step5.stage.teacherTag')}
        />
      </section>

      <Card>
        <ToggleRow
          label={t('step5.aiStage.label')}
          help={reading ? t('step5.aiStage.help') : readOnly}
          checked={v.aiStage}
          disabledReason={!reading && !v.aiStage ? readOnly : undefined}
          onChange={(aiStage) => onChange(setReview(exercise, { aiStage }))}
        />
        {reading && v.aiStage && (
          <>
            <ToggleRow
              label={t('step5.ai.transcript.label')}
              help={t('step5.ai.transcript.help')}
              checked={v.ai.transcript}
              onChange={(transcript) => onChange(setAi(exercise, { transcript }))}
            />
            {v.ai.transcript && (
              <PassPercentField
                value={v.readingPassPercent}
                onCommit={(readingPassPercent) =>
                  onChange(setReview(exercise, { readingPassPercent }))
                }
              />
            )}
            <ToggleRow
              label={t('step5.ai.pronunciation.label')}
              help={t('step5.ai.pronunciation.help')}
              checked={v.ai.pronunciation}
              onChange={(pronunciation) => onChange(setAi(exercise, { pronunciation }))}
            />
            <ToggleRow
              label={t('step5.ai.fluency.label')}
              help={t('step5.ai.fluency.help')}
              checked={v.ai.fluency}
              onChange={(fluency) => onChange(setAi(exercise, { fluency }))}
            />
          </>
        )}
      </Card>

      <Card>
        <Field label={t('step5.revisionLabel')}>
          <Segmented
            aria-label={t('step5.revisionLabel')}
            value={exercise.settings.revision}
            onValueChange={(revision) => onChange(setSettings(exercise, { revision }))}
            options={REVISIONS.map((value) => ({ value, label: t(`step5.revision.${value}`) }))}
          />
        </Field>
        <p className="m-0 text-xs text-(--ssz-text-muted)">{t('step5.revisionNote')}</p>
      </Card>

      <QueueLink containerId={containerId} />
    </div>
  );
}

/**
 * The reading check's threshold, `review.readingPassPercent` (plan 82, Q4).
 *
 * The kernel clamps to 50–100 on read, so a value outside the range would be saved and come back
 * as another. The field therefore holds what is being typed and commits only a value in range;
 * on blur whatever is left is clamped and shown as what the exercise will use, and an emptied
 * field shows the value it had.
 */
function PassPercentField({
  value,
  onCommit,
}: {
  value: number;
  onCommit: (value: number) => void;
}) {
  const t = useTranslations('Authoring.readAloud.step5.passPercent');
  const id = useId();
  const [draft, setDraft] = useState<string | null>(null);

  const inRange = (n: number) =>
    Number.isInteger(n) && n >= MIN_READING_PASS_PERCENT && n <= MAX_READING_PASS_PERCENT;

  return (
    <div className="flex items-start justify-between gap-4">
      <span>
        <label htmlFor={id} className="block text-sm">
          {t('label')}
        </label>
        <span id={`${id}-help`} className="block text-xs text-muted-foreground">
          {t('help', { min: MIN_READING_PASS_PERCENT, max: MAX_READING_PASS_PERCENT })}
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-1.5">
        <Input
          id={id}
          type="number"
          min={MIN_READING_PASS_PERCENT}
          max={MAX_READING_PASS_PERCENT}
          step={1}
          aria-describedby={`${id}-help`}
          className="w-[74px]"
          value={draft ?? String(value)}
          onChange={(event) => {
            const next = event.target.value;
            setDraft(next);
            const n = Number(next);
            if (next !== '' && inRange(n) && n !== value) onCommit(n);
          }}
          onBlur={() => {
            if (draft === null) return;
            // An emptied field means nothing was decided: it shows the value again.
            const n = draft === '' ? value : clampPassPercent(Number(draft));
            if (n !== value) onCommit(n);
            setDraft(null);
          }}
        />
        <span className="text-sm text-(--ssz-text-muted)" aria-hidden>
          %
        </span>
      </span>
    </div>
  );
}

/**
 * The way into the queue this exercise's recordings land in (deviation 10, as `writing_task`).
 *
 * The inbox filters by course and template, not by exercise, so the teacher arrives at every
 * read-aloud of this course with theirs among them. Outside a workspace route there is nowhere to
 * link to, and the section does not appear.
 */
function QueueLink({ containerId }: { containerId: string }) {
  const t = useTranslations('Authoring.readAloud.step5');
  const workspaceId = useWorkspaceRef();

  if (!workspaceId) return null;

  return (
    <section className="flex flex-col gap-2">
      <div>
        <p className="m-0 text-[11px] font-bold uppercase tracking-[0.08em] text-(--ssz-color-primary-600)">
          {t('queueEyebrow')}
        </p>
        <h3 className="m-0 mt-1 text-lg font-bold tracking-tight">{t('queueTitle')}</h3>
      </div>
      <p className="m-0 text-xs text-(--ssz-text-muted)">{t('queueHelp')}</p>
      <Link
        href={wsHref(workspaceId, `review?course=${containerId}&type=${TEMPLATE_CODE}`)}
        className="flex w-fit items-center gap-1.5 text-sm text-primary hover:underline"
      >
        <ExternalLink className="size-3.5" aria-hidden />
        {t('queueLink')}
      </Link>
    </section>
  );
}

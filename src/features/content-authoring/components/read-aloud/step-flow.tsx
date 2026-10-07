'use client';

import { Bot, ExternalLink, Mic, User } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Segmented } from '@/components/ui/segmented';
import { wsHref } from '@/features/workspaces/lib/href';
import { useWorkspaceRef } from '@/features/workspaces/lib/use-workspace-ref';
import { Link } from '@/lib/i18n/navigation';
import { AI_VISIBILITIES, REVISIONS, TEMPLATE_CODE } from '@/lib/shared-kernel/read-aloud';

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
 * Step 5: what happens to the recording after it is sent (plan 70 §7.6).
 *
 * The pipeline is the point of the step: Opptak, AI-forsjekk, Lærer — and only the middle one is
 * optional. A recording always ends at a person, and the diagram says so rather than leaving the
 * author to infer it from the absence of a switch. The AI stage is drawn and switchable and calls
 * nothing (DECISIONS §4, plan 48), so when it is on it is tagged as a preview: a stage that looked
 * live would be a promise this build cannot keep.
 *
 * There is no queue on this screen. The handoff drew one here; deviation 10 keeps the single
 * queue the platform already has, and this step links into it.
 */
export function StepFlow({ exercise, containerId, onChange }: StepFlowProps) {
  const t = useTranslations('Authoring.readAloud.step5');
  const v = exercise.review;

  return (
    <div className="flex flex-col gap-5">
      <StepHead eyebrow={t('eyebrow')} title={t('title')} lede={t('lede')} />

      <section className="grid gap-3 sm:grid-cols-3" aria-label={t('pipeline')}>
        <PipelineStage
          icon={Mic}
          when={t('stage.nowWhen')}
          title={t('stage.now')}
          body={t('stage.nowBody')}
          tag={t('stage.nowTag')}
        />
        <PipelineStage
          icon={Bot}
          off={!v.aiStage}
          when={t('stage.aiWhen')}
          title={t('stage.ai')}
          body={t('stage.aiBody')}
          tag={v.aiStage ? t('stage.aiPreview') : t('stage.aiOff')}
        />
        <PipelineStage
          icon={User}
          when={t('stage.teacherWhen')}
          title={t('stage.teacher')}
          body={t('stage.teacherBody')}
          tag={t('stage.teacherTag')}
        />
      </section>

      <Card>
        <ToggleRow
          label={t('aiStage.label')}
          help={t('aiStage.help')}
          checked={v.aiStage}
          onChange={(aiStage) => onChange(setReview(exercise, { aiStage }))}
        />
        {v.aiStage && (
          <>
            <ToggleRow
              label={t('ai.transcript.label')}
              help={t('ai.transcript.help')}
              checked={v.ai.transcript}
              onChange={(transcript) => onChange(setAi(exercise, { transcript }))}
            />
            <ToggleRow
              label={t('ai.pronunciation.label')}
              help={t('ai.pronunciation.help')}
              checked={v.ai.pronunciation}
              onChange={(pronunciation) => onChange(setAi(exercise, { pronunciation }))}
            />
            <ToggleRow
              label={t('ai.draft.label')}
              help={t('ai.draft.help')}
              checked={v.ai.draft}
              onChange={(draft) => onChange(setAi(exercise, { draft }))}
            />
            <Field label={t('visibilityLabel')}>
              <Segmented
                aria-label={t('visibilityLabel')}
                value={v.aiVisibility}
                onValueChange={(aiVisibility) => onChange(setReview(exercise, { aiVisibility }))}
                options={AI_VISIBILITIES.map((value) => ({
                  value,
                  label: t(`visibility.${value}`),
                }))}
              />
            </Field>
          </>
        )}
      </Card>

      <Card>
        <Field label={t('revisionLabel')}>
          <Segmented
            aria-label={t('revisionLabel')}
            value={exercise.settings.revision}
            onValueChange={(revision) => onChange(setSettings(exercise, { revision }))}
            options={REVISIONS.map((value) => ({ value, label: t(`revision.${value}`) }))}
          />
        </Field>
        <p className="m-0 text-xs text-(--ssz-text-muted)">{t('revisionNote')}</p>
      </Card>

      <QueueLink containerId={containerId} />
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

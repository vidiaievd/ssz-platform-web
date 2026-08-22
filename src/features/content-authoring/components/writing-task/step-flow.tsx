'use client';

import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Bot, ExternalLink, PenLine, User } from 'lucide-react';

import { Checkbox } from '@/components/ui/checkbox';
import { Segmented } from '@/components/ui/segmented';
import { Link } from '@/lib/i18n/navigation';
import {
  issues,
  type Ai,
  type AiSelfLimit,
  type AiVisibility,
  type RevisionPolicy,
  type WritingTask,
} from '@/lib/shared-kernel/writing-task';

import { setAi, setSettings } from './edits';
import { ToggleRow } from '../toggle-row';

/** The order the checks are listed in, which is the order they run in a marking pass. */
const AI_CHECKS: (keyof Ai)[] = ['task', 'grammar', 'structure', 'lexis', 'draft'];

const VISIBILITIES: AiVisibility[] = ['teacher', 'studentBefore', 'studentAfter'];
const SELF_LIMITS: AiSelfLimit[] = [0, 1, 2, 3];
const REVISIONS: RevisionPolicy[] = ['once', 'return', 'drafts'];

export interface StepFlowProps {
  exercise: WritingTask;
  /** The course this exercise lives in — what the queue link filters on. */
  containerId: string;
  onChange: (next: WritingTask) => void;
}

/**
 * Step 4: what happens to the text after the student presses send.
 *
 * The pipeline at the top is the whole point of the step. Three stages, and only the
 * middle one is optional: a free text always ends at a person, and the diagram says so
 * rather than leaving the author to infer it from the absence of a switch. The AI stage
 * is drawn dimmed and tagged when off, and tagged as a preview when on, because nothing
 * behind it calls a model in this build (plan 50 §3.5) — a stage that looked live would
 * be a promise this build cannot keep.
 *
 * There is no marking queue on this screen. The handoff put one here; plan 50 §3.3 keeps
 * the one queue the platform already has — locks, SLA, batching and notifications all
 * live there — and this step links into it instead.
 */
export function StepFlow({ exercise, containerId, onChange }: StepFlowProps) {
  const t = useTranslations('Authoring');
  const s = exercise.settings;
  const problems = issues(exercise).filter((issue) => issue.step === 4);
  const noSelfLimit = problems.some((issue) => issue.code === 'AI_NO_SELF_LIMIT');
  const draftWithoutStage = problems.some((issue) => issue.code === 'AI_STAGE_OFF_DRAFT_ON');
  const checksOn = AI_CHECKS.filter((check) => s.ai[check]).length;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-base font-semibold">{t('writingTask.step4.title')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t('writingTask.step4.lede')}</p>
      </div>

      <section className="grid gap-3 sm:grid-cols-3" aria-label={t('writingTask.step4.pipeline')}>
        <Stage
          icon={PenLine}
          when={t('writingTask.step4.stageWritingWhen')}
          title={t('writingTask.step4.stageWriting')}
          body={[
            t('writingTask.step4.stageWritingDraft'),
            s.minWords > 0 ? t('writingTask.step4.stageWritingLength') : null,
            s.timer > 0 ? t('writingTask.step4.stageWritingTimer') : null,
            s.blockPaste ? t('writingTask.step4.stageWritingPaste') : null,
          ]
            .filter((part) => part !== null)
            .join(t('writingTask.step4.stageJoin'))}
        />
        <Stage
          icon={Bot}
          off={!s.aiStage}
          when={t('writingTask.step4.stageAiWhen')}
          title={t('writingTask.step4.stageAi')}
          body={t('writingTask.step4.stageAiBody', {
            count: checksOn,
            audience: t(
              `writingTask.step4.audience.${s.aiVisibility}` as 'writingTask.step4.audience.teacher',
            ),
          })}
          tag={s.aiStage ? t('writingTask.step4.tagPreview') : t('writingTask.step4.tagOff')}
        />
        <Stage
          icon={User}
          when={t('writingTask.step4.stageTeacherWhen')}
          title={t('writingTask.step4.stageTeacher')}
          body={t('writingTask.step4.stageTeacherBody')}
        />
      </section>

      <section className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4">
        <ToggleRow
          label={t('writingTask.step4.aiStageLabel')}
          help={t('writingTask.step4.aiStageHelp')}
          checked={s.aiStage}
          onChange={(aiStage) => onChange(setSettings(exercise, { aiStage }))}
        />

        {/* An observation, not a fault: the kernel files it as `info` and the gate leaves
            it out. It belongs here, next to the switch that causes it. */}
        {draftWithoutStage && (
          <p className="text-xs text-muted-foreground" role="status">
            {t('writingTask.step4.draftWithoutStage')}
          </p>
        )}

        {s.aiStage && (
          <>
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 text-xs font-medium">
                {t('writingTask.step4.checksLabel')}
              </legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {AI_CHECKS.map((check) => (
                  <label
                    key={check}
                    className={`flex items-start gap-2 rounded-lg border p-3 ${
                      s.ai[check] ? 'border-primary/40 bg-(--ssz-bg-subtle)' : 'border-border'
                    }`}
                  >
                    <Checkbox
                      className="mt-0.5"
                      checked={s.ai[check]}
                      onCheckedChange={(checked) =>
                        onChange(setAi(exercise, { [check]: checked === true }))
                      }
                    />
                    <span>
                      <span className="block text-sm">
                        {t(
                          `writingTask.step4.checks.${check}.label` as 'writingTask.step4.checks.task.label',
                        )}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {t(
                          `writingTask.step4.checks.${check}.help` as 'writingTask.step4.checks.task.help',
                        )}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="max-w-md">
                <p className="text-sm">{t('writingTask.step4.visibilityLabel')}</p>
                <p className="text-xs text-muted-foreground">
                  {t('writingTask.step4.visibilityHelp')}
                </p>
              </div>
              <Segmented<AiVisibility>
                aria-label={t('writingTask.step4.visibilityLabel')}
                value={s.aiVisibility}
                onValueChange={(aiVisibility) => onChange(setSettings(exercise, { aiVisibility }))}
                options={VISIBILITIES.map((visibility) => ({
                  value: visibility,
                  label: t(
                    `writingTask.step4.audienceShort.${visibility}` as 'writingTask.step4.audienceShort.teacher',
                  ),
                }))}
              />
            </div>

            {s.aiVisibility === 'studentBefore' && (
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="max-w-md">
                  <p className="text-sm">{t('writingTask.step4.selfLimitLabel')}</p>
                  <p
                    className={`text-xs ${noSelfLimit ? 'text-warning-700' : 'text-muted-foreground'}`}
                  >
                    {t('writingTask.step4.selfLimitHelp')}
                  </p>
                </div>
                <Segmented<string>
                  aria-label={t('writingTask.step4.selfLimitLabel')}
                  value={String(s.aiSelfLimit)}
                  onValueChange={(value) =>
                    onChange(setSettings(exercise, { aiSelfLimit: Number(value) as AiSelfLimit }))
                  }
                  options={SELF_LIMITS.map((limit) => ({
                    value: String(limit),
                    label: limit === 0 ? t('writingTask.step4.selfLimitNone') : String(limit),
                  }))}
                />
              </div>
            )}
          </>
        )}

        <div className="flex flex-wrap items-start justify-between gap-3 border-t border-border pt-4">
          <div className="max-w-md">
            <p className="text-sm">{t('writingTask.step4.revisionLabel')}</p>
            <p className="text-xs text-muted-foreground">{t('writingTask.step4.revisionHelp')}</p>
          </div>
          <Segmented<RevisionPolicy>
            aria-label={t('writingTask.step4.revisionLabel')}
            value={s.revision}
            onValueChange={(revision) => onChange(setSettings(exercise, { revision }))}
            options={REVISIONS.map((revision) => ({
              value: revision,
              label: t(
                `writingTask.step4.revisions.${revision}` as 'writingTask.step4.revisions.once',
              ),
            }))}
          />
        </div>
      </section>

      <QueueLink containerId={containerId} />
    </div>
  );
}

/** One box in the pipeline. `off` dims it; nothing here is interactive. */
function Stage({
  icon: Icon,
  when,
  title,
  body,
  tag,
  off = false,
}: {
  icon: typeof Bot;
  when: string;
  title: string;
  body: string;
  tag?: string;
  off?: boolean;
}) {
  return (
    <div
      className={`flex flex-col gap-1 rounded-lg border border-border p-3 ${
        off ? 'opacity-55' : ''
      }`}
    >
      <span className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        <Icon className="size-3" aria-hidden />
        {when}
      </span>
      <strong className="text-sm">{title}</strong>
      <p className="text-xs text-muted-foreground">{body}</p>
      {tag !== undefined && (
        <span className="mt-1 w-fit rounded-full bg-(--ssz-bg-subtle) px-2 py-0.5 text-[11px] text-muted-foreground">
          {tag}
        </span>
      )}
    </div>
  );
}

/**
 * The way into the queue this exercise's submissions land in.
 *
 * The handoff drew the queue inside the builder. This is the link that replaces it, and
 * it is honest about being coarser than the drawing: the inbox filters by course and
 * template, not by exercise (`review/lib/queue-filters.ts`), so the teacher lands on
 * every writing task in this course grouped by exercise, with theirs among them. A real
 * `exercise=<id>` filter is work in the BFF and the engine, not in this step.
 *
 * The school slug comes from the route because that is where it exists — the editor pane
 * has never carried one. Outside a school route there is nowhere to link to, and the
 * section simply does not appear.
 */
function QueueLink({ containerId }: { containerId: string }) {
  const t = useTranslations('Authoring');
  const { schoolSlug } = useParams<{ schoolSlug?: string }>();

  if (!schoolSlug) return null;

  return (
    <section className="flex flex-col gap-2 rounded-lg border border-dashed border-border p-4">
      <h3 className="text-xs font-medium">{t('writingTask.step4.queueLabel')}</h3>
      <p className="text-xs text-muted-foreground">{t('writingTask.step4.queueHelp')}</p>
      <Link
        href={`/school/${schoolSlug}/review?course=${containerId}&type=writing_task`}
        className="flex w-fit items-center gap-1.5 text-sm text-primary hover:underline"
      >
        <ExternalLink className="size-3.5" aria-hidden />
        {t('writingTask.step4.queueLink')}
      </Link>
    </section>
  );
}

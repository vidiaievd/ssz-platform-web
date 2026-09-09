'use client';

import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Bot, ExternalLink, Target, User } from 'lucide-react';

import { Segmented } from '@/components/ui/segmented';
import { Link } from '@/lib/i18n/navigation';
import {
  coverage,
  TEMPLATE_CODE,
  type TeacherReviewPolicy,
} from '@/lib/shared-kernel/short-answer';

import { setSettings, type ShortAnswerDocument } from './edits';
import { PipelineStage } from '../pipeline-stage';
import { ToggleRow } from '../toggle-row';

const POLICIES: TeacherReviewPolicy[] = ['all', 'flagged', 'none'];

export interface StepReviewProps {
  exercise: ShortAnswerDocument;
  /** The course this exercise lives in — what the queue link filters on. */
  containerId: string;
  onChange: (next: ShortAnswerDocument) => void;
}

/**
 * Step 4: what happens to an answer after the student presses send.
 *
 * The pipeline at the top is the point of the step — phrase match, then AI, then a person —
 * and the middle stage is the only optional one in the sense that matters: it does not
 * exist yet. It is drawn dimmed and tagged, because a stage that looked live would be a
 * promise this build cannot keep (plan 51 §3.6). The switches beneath it are stored and
 * nothing reads them at runtime.
 *
 * The last stage *can* be switched off, and that is the one setting on this screen worth
 * hesitating over: `teacherReview: 'none'` means the phrase match has the last word on a
 * free written answer. It is allowed — some sets are self-study — and it raises a warning
 * rather than a blocker, said here as well as in the gate.
 *
 * There is no marking queue on this screen. The handoff drew one (its "Rettekø"), and plan
 * 51 §3.5 keeps the one queue the platform already has — locks, SLA, batching and
 * notifications all live there — with this step linking into it instead. What the handoff
 * called the most useful loop in the builder, trying a student answer against the key,
 * lives on step 2 where the key is.
 */
export function StepReview({ exercise, containerId, onChange }: StepReviewProps) {
  const t = useTranslations('Authoring');
  const s = exercise.settings;
  const cov = coverage(exercise);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-base font-semibold">{t('shortAnswer.step4.title')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t('shortAnswer.step4.lede')}</p>
      </div>

      <section className="grid gap-3 sm:grid-cols-3" aria-label={t('shortAnswer.step4.pipeline')}>
        <PipelineStage
          icon={Target}
          when={t('shortAnswer.step4.stageMatchWhen')}
          title={t('shortAnswer.step4.stageMatch')}
          body={t('shortAnswer.step4.stageMatchBody', { count: cov.anchors })}
        />
        <PipelineStage
          icon={Bot}
          off={!s.aiStage}
          when={t('shortAnswer.step4.stageAiWhen')}
          title={t('shortAnswer.step4.stageAi')}
          body={
            s.aiGrammar
              ? t('shortAnswer.step4.stageAiBodyGrammar')
              : t('shortAnswer.step4.stageAiBody')
          }
          tag={s.aiStage ? t('shortAnswer.step4.tagPreview') : t('shortAnswer.step4.tagOff')}
        />
        <PipelineStage
          icon={User}
          off={s.teacherReview === 'none'}
          when={t('shortAnswer.step4.stageTeacherWhen')}
          title={t('shortAnswer.step4.stageTeacher')}
          body={t(
            `shortAnswer.step4.stageTeacherBody_${s.teacherReview}` as 'shortAnswer.step4.stageTeacherBody_all',
          )}
        />
      </section>

      <section className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="max-w-md">
            <p className="text-sm">{t('shortAnswer.step4.teacherLabel')}</p>
            <p
              className={`text-xs ${
                s.teacherReview === 'none' ? 'text-warning-700' : 'text-muted-foreground'
              }`}
            >
              {s.teacherReview === 'none'
                ? t('shortAnswer.issues.NO_TEACHER_REVIEW')
                : t('shortAnswer.step4.teacherHelp')}
            </p>
          </div>
          <Segmented<TeacherReviewPolicy>
            aria-label={t('shortAnswer.step4.teacherLabel')}
            value={s.teacherReview}
            onValueChange={(teacherReview) => onChange(setSettings(exercise, { teacherReview }))}
            options={POLICIES.map((policy) => ({
              value: policy,
              label: t(`shortAnswer.step4.teacher_${policy}` as 'shortAnswer.step4.teacher_all'),
            }))}
          />
        </div>

        <div className="border-t border-border pt-4">
          <ToggleRow
            label={t('shortAnswer.step4.aiStageLabel')}
            help={t('shortAnswer.step4.aiStageHelp')}
            checked={s.aiStage}
            onChange={(aiStage) => onChange(setSettings(exercise, { aiStage }))}
          />
        </div>

        {/* Only when the stage is on: a switch about how a check words itself is noise
            beside a check that is not running. */}
        {s.aiStage && (
          <ToggleRow
            label={t('shortAnswer.step4.aiGrammarLabel')}
            help={t('shortAnswer.step4.aiGrammarHelp')}
            checked={s.aiGrammar}
            onChange={(aiGrammar) => onChange(setSettings(exercise, { aiGrammar }))}
          />
        )}
      </section>

      <QueueLink containerId={containerId} />
    </div>
  );
}

/**
 * The way into the queue this exercise's answers land in.
 *
 * The handoff drew the queue inside the builder. This is the link that replaces it, and it
 * is honest about being coarser than the drawing: the inbox filters by course and template,
 * not by exercise (`review/lib/queue-filters.ts`), so the teacher lands on every short
 * answer in this course grouped by exercise, with theirs among them.
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
      <h3 className="text-xs font-medium">{t('shortAnswer.step4.queueLabel')}</h3>
      <p className="text-xs text-muted-foreground">{t('shortAnswer.step4.queueHelp')}</p>
      <Link
        href={`/school/${schoolSlug}/review?course=${containerId}&type=${TEMPLATE_CODE}`}
        className="flex w-fit items-center gap-1.5 text-sm text-primary hover:underline"
      >
        <ExternalLink className="size-3.5" aria-hidden />
        {t('shortAnswer.step4.queueLink')}
      </Link>
    </section>
  );
}

'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { useCan } from '@/features/entitlements';

import { useCourseReviewPolicy, useSaveCourseReviewPolicy } from '../../api/use-review-settings';
import type { ReviewableExerciseType } from '../../types';

const MIN_HOURS = 1;
const MAX_HOURS = 720;

/**
 * The templates a model can answer (exercise-engine `reviewSubject`). `read_aloud` is
 * reviewed by a person only, so marking it "always to the teacher" would change nothing.
 */
const AI_REVIEWED_TYPES: ReviewableExerciseType[] = [
  'writing_task',
  'short_answer',
  'translate_to_target',
  'translate_from_target',
  'error_correction',
];

export interface CourseAiPolicyFieldProps {
  containerId: string;
  canEdit?: boolean;
}

interface Draft {
  overridden: boolean;
  hours: number;
  templates: string[];
}

/**
 * This course's part of the school's review policy (plan 80, Q1/Q4): its own auto-accept
 * term — an intensive course wants a model's verdict to count sooner than a slow one — and
 * the exercise types whose work always goes to a teacher when the school samples.
 *
 * Drawn only where the plan carries `school.review_ai_policy`, like the school's own block.
 * It can be shaped while the school still has the teacher alone: it says so, and takes
 * effect the day the school turns a model on.
 *
 * A term below the school's escalation is not refused — content-service raises it to the
 * escalation on read (Q2-A) — so the field says what it will become rather than an error.
 */
export function CourseAiPolicyField({ containerId, canEdit = true }: CourseAiPolicyFieldProps) {
  const t = useTranslations('Review.settings.coursePolicy');
  const tType = useTranslations('Review.type');
  const can = useCan();
  const entitled = can('school.review_ai_policy');

  const { data, isError } = useCourseReviewPolicy(containerId, entitled);
  const save = useSaveCourseReviewPolicy(containerId);
  const [draft, setDraft] = useState<Draft | null>(null);

  if (!entitled) return null;
  if (isError) return <p className="text-[12.5px] text-muted-foreground">{t('failed')}</p>;
  if (!data) return <Skeleton className="h-32 w-full rounded-lg" />;

  const inherited = data.inheritedAutoAcceptAfterHours;
  const form: Draft = draft ?? {
    overridden: data.overridden,
    hours: data.autoAcceptAfterHours ?? inherited ?? 168,
    templates: data.teacherReviewTemplates,
  };
  const outOfBounds =
    !Number.isInteger(form.hours) || form.hours < MIN_HOURS || form.hours > MAX_HOURS;
  const floor = data.escalationFloorHours;
  const raised = form.overridden && !outOfBounds && floor !== null && form.hours < floor;
  const changed = draft !== null;

  const toggleTemplate = (code: string, on: boolean) =>
    setDraft({
      ...form,
      templates: on
        ? [...form.templates, code]
        : form.templates.filter((template) => template !== code),
    });

  const submit = () => {
    save.mutate(
      {
        autoAcceptAfterHours: form.overridden ? form.hours : null,
        teacherReviewTemplates: form.templates,
      },
      {
        onSuccess: () => {
          setDraft(null);
          toast.success(t('saved'));
        },
        onError: () => toast.error(t('saveFailed')),
      },
    );
  };

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border p-4">
      <div>
        <h3 className="text-sm font-semibold">{t('title')}</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">{t('lede')}</p>
        {data.schoolMode === null || data.schoolMode === 'teacher_only' ? (
          <p className="mt-1.5 text-xs text-muted-foreground">{t('schoolTeacherOnly')}</p>
        ) : null}
      </div>

      <label className="flex cursor-pointer items-center gap-2.5">
        <Checkbox
          checked={form.overridden}
          disabled={!canEdit}
          onCheckedChange={(checked) => setDraft({ ...form, overridden: checked === true })}
        />
        <span className="text-[13.5px] font-semibold">{t('ownTerm')}</span>
      </label>

      <div className="pl-[26px]">
        <span className="flex items-center gap-2">
          <input
            type="number"
            inputMode="numeric"
            min={MIN_HOURS}
            max={MAX_HOURS}
            aria-label={t('fieldLabel')}
            value={form.overridden ? form.hours : (inherited ?? '')}
            disabled={!form.overridden || !canEdit}
            onChange={(event) => setDraft({ ...form, hours: Number(event.target.value) })}
            className="w-24 rounded-[9px] border-[1.5px] border-border bg-(--ssz-bg-base) px-[11px] py-2 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:text-muted-foreground"
          />
          <span className="text-[12.5px] text-(--ssz-text-secondary)">{t('hours')}</span>
        </span>

        <p className="mt-1.5 text-[11.5px] text-muted-foreground">
          {inherited === null ? t('noSchoolTerm') : t('inheritedFrom', { n: inherited })}
        </p>

        {form.overridden && outOfBounds ? (
          <p className="mt-1 text-[11.5px] text-error-600 dark:text-error-400">
            {t('bounds', { min: MIN_HOURS, max: MAX_HOURS })}
          </p>
        ) : null}
        {raised ? (
          <p className="mt-1 text-[11.5px] text-warning-700 dark:text-warning-300">
            {t('raised', { n: floor })}
          </p>
        ) : null}
      </div>

      <fieldset className="flex flex-col gap-2" disabled={!canEdit}>
        <legend className="text-[13.5px] font-semibold">{t('templates.label')}</legend>
        <p className="text-xs text-muted-foreground">{t('templates.hint')}</p>
        {AI_REVIEWED_TYPES.map((code) => (
          <label key={code} className="flex cursor-pointer items-center gap-2.5">
            <Checkbox
              checked={form.templates.includes(code)}
              disabled={!canEdit}
              onCheckedChange={(checked) => toggleTemplate(code, checked === true)}
            />
            <span className="text-[13px]">{tType(code)}</span>
          </label>
        ))}
      </fieldset>

      {canEdit ? (
        <div>
          <Button
            size="sm"
            variant="outline"
            disabled={!changed || (form.overridden && outOfBounds) || save.isPending}
            onClick={submit}
          >
            {t('save')}
          </Button>
        </div>
      ) : null}
    </section>
  );
}

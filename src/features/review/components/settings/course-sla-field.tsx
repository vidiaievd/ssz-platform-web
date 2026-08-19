'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';

import { reviewKeys } from '../../api/keys';
import {
  useCourseReviewSettings,
  useSaveCourseReviewSettings,
} from '../../api/use-review-settings';

const MIN_HOURS = 1;
const MAX_HOURS = 720;

export interface CourseSlaFieldProps {
  containerId: string;
  /** An editor of the course may set it; anyone else sees what it is. */
  canEdit?: boolean;
}

/**
 * This course's own response time, if it wants one.
 *
 * The field is never empty (criterion 35). With the override off it shows the school's
 * figure, greyed and unwritable — because a blank box beside "response time" reads as
 * "nothing is promised", which is the opposite of what inheriting means. Switching the box
 * on keeps that number as the starting point, so turning the override on and saving
 * immediately changes nothing, which is exactly what it should do.
 *
 * Saving invalidates everything that carries a colour: this number decides how the queue is
 * painted, which submissions count as stuck in oversight, and the date the learner is shown
 * while they wait (criterion 34).
 */
export function CourseSlaField({ containerId, canEdit = true }: CourseSlaFieldProps) {
  const t = useTranslations('Review.settings.course');
  const queryClient = useQueryClient();

  const { data, isPending, isError } = useCourseReviewSettings(containerId);
  const save = useSaveCourseReviewSettings(containerId);

  // Nothing is held until somebody touches the control: until then the field reads from
  // the query, so a refetch cannot overwrite an edit and an edit cannot go stale.
  const [draft, setDraft] = useState<{ overridden: boolean; hours: number } | null>(null);

  if (isError) return <p className="text-[12.5px] text-muted-foreground">{t('failed')}</p>;
  if (!data || isPending) return <Skeleton className="h-24 w-full rounded-lg" />;

  const inherited = data.inheritedHours;
  // The starting point when the box is ticked is the number that already applies —
  // switching the override on and saving at once must change nothing.
  const { overridden, hours } = draft ?? {
    overridden: data.overridden,
    hours: data.respondWithinHours ?? data.inheritedHours ?? 48,
  };
  const outOfBounds = hours < MIN_HOURS || hours > MAX_HOURS;
  const changed =
    overridden !== data.overridden || (overridden && hours !== data.respondWithinHours);

  const submit = () => {
    save.mutate(overridden ? hours : null, {
      onSuccess: () => {
        setDraft(null);
        toast.success(t('saved'));
        void queryClient.invalidateQueries({ queryKey: reviewKeys.queues() });
        void queryClient.invalidateQueries({ queryKey: reviewKeys.counts() });
        void queryClient.invalidateQueries({ queryKey: reviewKeys.oversights() });
        void queryClient.invalidateQueries({ queryKey: reviewKeys.submissions() });
      },
      onError: () => toast.error(t('saveFailed')),
    });
  };

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border p-4">
      <div>
        <h3 className="text-sm font-semibold">{t('title')}</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">{t('lede')}</p>
      </div>

      <label className="flex cursor-pointer items-center gap-2.5">
        <Checkbox
          checked={overridden}
          disabled={!canEdit}
          onCheckedChange={(checked) => setDraft({ overridden: checked === true, hours })}
        />
        <span className="text-[13.5px] font-semibold">{t('ownTime')}</span>
      </label>

      <div className="pl-[26px]">
        <span className="flex items-center gap-2">
          <input
            type="number"
            inputMode="numeric"
            min={MIN_HOURS}
            max={MAX_HOURS}
            aria-label={t('fieldLabel')}
            // Inheriting shows the school's number rather than the course's stale one: it
            // is what a submission of this course is actually held to right now.
            value={overridden ? hours : (inherited ?? '')}
            disabled={!overridden || !canEdit}
            onChange={(event) => setDraft({ overridden, hours: Number(event.target.value) })}
            className="w-24 rounded-[9px] border-[1.5px] border-border bg-(--ssz-bg-base) px-[11px] py-2 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:text-muted-foreground"
          />
          <span className="text-[12.5px] text-(--ssz-text-secondary)">{t('hours')}</span>
        </span>

        <p className="mt-1.5 text-[11.5px] text-muted-foreground">
          {inherited === null
            ? t('noSchoolPromise')
            : overridden
              ? t('inheritedIs', { n: inherited })
              : t('inheritedFrom', { n: inherited })}
        </p>

        {outOfBounds && overridden ? (
          <p className="mt-1 text-[11.5px] text-error-600 dark:text-error-400">
            {t('bounds', { min: MIN_HOURS, max: MAX_HOURS })}
          </p>
        ) : null}
      </div>

      {canEdit ? (
        <div>
          <Button
            size="sm"
            variant="outline"
            disabled={!changed || (overridden && outOfBounds) || save.isPending}
            onClick={submit}
          >
            {t('save')}
          </Button>
        </div>
      ) : null}
    </section>
  );
}

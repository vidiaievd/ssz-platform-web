'use client';

import { useState } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import { AlertTriangle, ClipboardCheck, Repeat } from 'lucide-react';

import { Button } from '@/components/ui/button';
import type { ReviewBlock } from '@/lib/scheduling/provider';
import { ReviewBlockActionsMenu } from '@/features/schedule/components/review-block-actions-menu';
import { ReviewBlockDialog } from '@/features/schedule/components/review-block-dialog';
import { HELD_TIME_WEEKS, type HeldTime } from '@/features/schedule/lib/held-time';

type TeacherReviewBlocksProps = {
  schoolId: string;
  teacherId: string;
  held: HeldTime;
  /** The blocks could not be read; the panel says so instead of showing an empty week. */
  error: boolean;
  /** The first day the panel counts from, and where a new block lands. */
  from: string;
};

/**
 * A teacher's time for marking, held by the school (plan 81, step 7).
 *
 * Listed as rules, not drawn as a week: the school sets "Thursdays 16–17" for somebody
 * else and checks it against their load, while the sittings themselves belong on the
 * teacher's own week. For the same reason there is no "not this time" here — skipping a
 * day is the teacher's call, made from their week.
 */
export function TeacherReviewBlocks({
  schoolId,
  teacherId,
  held,
  error,
  from,
}: TeacherReviewBlocksProps) {
  const t = useTranslations('Teachers.schedule.reviewBlocks');
  const format = useFormatter();
  const [adding, setAdding] = useState(false);

  const day = (
    iso: string,
    options: { weekday?: 'long' | 'short'; day?: 'numeric'; month?: 'short'; year?: 'numeric' },
  ) => format.dateTime(new Date(`${iso}T00:00:00.000Z`), { ...options, timeZone: 'UTC' });

  const ruleLabel = (block: ReviewBlock) => {
    const time = `${block.start}–${block.end}`;
    return block.repeat === 'weekly'
      ? t('everyWeekday', { weekday: day(block.startsOn, { weekday: 'long' }), time })
      : t('onDay', {
          day: day(block.startsOn, { weekday: 'short', day: 'numeric', month: 'short' }),
          time,
        });
  };

  const spanLabel = (block: ReviewBlock) => {
    if (block.repeat !== 'weekly') return null;
    const since = day(block.startsOn, { day: 'numeric', month: 'short', year: 'numeric' });
    return block.endsOn
      ? t('between', {
          since,
          until: day(block.endsOn, { day: 'numeric', month: 'short', year: 'numeric' }),
        })
      : t('since', { since });
  };

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-(--ssz-text-primary)">{t('title')}</h2>
          <p className="mt-0.5 text-xs text-(--ssz-text-muted)">{t('lede')}</p>
        </div>
        <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
          <ClipboardCheck className="mr-1.5 size-4" aria-hidden />
          {t('add')}
        </Button>
      </div>

      {error ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {t('loadFailed')}
        </p>
      ) : held.blocks.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center">
          <p className="text-sm font-medium text-(--ssz-text-primary)">{t('empty')}</p>
          <p className="mt-1 text-xs text-(--ssz-text-muted)">{t('emptyBody')}</p>
        </div>
      ) : (
        <>
          <p className="text-sm text-(--ssz-text-secondary)">
            {t('perWeek', { hours: format.number(held.hoursPerWeek), weeks: HELD_TIME_WEEKS })}
          </p>

          <ul className="divide-y divide-border rounded-lg border border-border">
            {held.blocks.map(({ block, sittings, overlapDays }) => {
              const label = ruleLabel(block);
              const span = spanLabel(block);
              return (
                <li key={block.id} className="flex items-start gap-3 px-3 py-2.5">
                  {block.repeat === 'weekly' ? (
                    <Repeat
                      className="mt-0.5 size-4 shrink-0 text-(--ssz-text-muted)"
                      aria-label={t('weekly')}
                    />
                  ) : (
                    <ClipboardCheck
                      className="mt-0.5 size-4 shrink-0 text-(--ssz-text-muted)"
                      aria-label={t('oneOff')}
                    />
                  )}

                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-(--ssz-text-primary) tabular-nums">
                      {label}
                    </p>
                    <p className="text-xs text-(--ssz-text-muted)">
                      {[
                        span,
                        block.repeat === 'weekly'
                          ? t('sittings', { count: sittings, weeks: HELD_TIME_WEEKS })
                          : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                    {block.note && (
                      <p title={block.note} className="truncate text-xs text-(--ssz-text-muted)">
                        {block.note}
                      </p>
                    )}
                    {overlapDays > 0 && (
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-warning-700 dark:text-warning-400">
                        <AlertTriangle className="size-3" aria-hidden="true" />
                        {t('overlaps', { count: overlapDays, weeks: HELD_TIME_WEEKS })}
                      </p>
                    )}
                  </div>

                  <ReviewBlockActionsMenu
                    workspaceId={schoolId}
                    teacherId={teacherId}
                    block={block}
                    label={label}
                  />
                </li>
              );
            })}
          </ul>
        </>
      )}

      {adding && (
        <ReviewBlockDialog
          open
          onOpenChange={setAdding}
          workspaceId={schoolId}
          teacherId={teacherId}
          defaultDate={from}
        />
      )}
    </div>
  );
}

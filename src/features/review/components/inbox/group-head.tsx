'use client';

import { ChevronDown } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { cn } from '@/lib/utils';

import {
  REVIEWABLE_EXERCISE_TYPES,
  type ReviewQueueGroup,
  type ReviewableExerciseType,
} from '../../types';
import { AgeSpread } from '../age-spread';

export interface GroupHeadProps {
  group: ReviewQueueGroup;
  open: boolean;
  onToggle: () => void;
  /** How many of this group's submissions the machine closed and nobody else holds. */
  cleanCount: number;
  /** The id of the list this heading folds, so the button can point a reader at it. */
  controls?: string;
  /** Opens the confirmation. The heading never approves anything by itself. */
  onBatch?: (group: ReviewQueueGroup) => void;
}

/**
 * The heading of one pass: what it is, how much of it there is, and what shape it is in.
 *
 * Sticky, because a group can be longer than the column and a row halfway down it means
 * nothing without the exercise it belongs to. The histogram under the title is the part
 * that earns its place in a school that has fallen behind: a count says 34 and stops,
 * while the spread of ages says whether those 34 arrived this morning or have been sitting
 * since last month, which are two different days of work.
 *
 * The batch button appears only when at least two submissions were closed by the machine
 * outright. It stops the click from reaching the header — pressing "pass 6 clean" should
 * never also fold the group away underneath the dialog it opens.
 */
export function GroupHead({
  group,
  open,
  onToggle,
  cleanCount,
  controls,
  onBatch,
}: GroupHeadProps) {
  const t = useTranslations('Review');
  // The snapshot may name a type this build does not know — it is shown as it came
  // rather than dropped, since a stale label still tells a teacher where they are.
  const rawType = group.path?.type ?? null;
  const typeLabel =
    rawType !== null && (REVIEWABLE_EXERCISE_TYPES as readonly string[]).includes(rawType)
      ? t(`type.${rawType as ReviewableExerciseType}`)
      : rawType;
  const path = [group.path?.course, group.path?.lesson, typeLabel].filter(Boolean).join(' · ');

  return (
    <div className="sticky top-0 z-[2] bg-(--ssz-bg-surface) pt-2">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={controls}
        className={cn(
          'flex w-full items-center gap-[9px] rounded-[9px] px-2.5 py-[7px] text-left outline-none',
          'hover:bg-(--ssz-bg-subtle) focus-visible:ring-2 focus-visible:ring-ring',
        )}
      >
        <ChevronDown
          aria-hidden
          className={cn(
            'h-[15px] w-[15px] shrink-0 text-muted-foreground transition-transform duration-[160ms]',
            open ? '' : '-rotate-90',
          )}
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[12.5px] font-bold">
            {group.title ?? t('inbox.row.exerciseGone')}
          </span>
          {path === '' ? null : (
            <span className="block truncate text-[11px] text-muted-foreground">{path}</span>
          )}
        </span>
        <span className="shrink-0 rounded-full bg-(--ssz-bg-subtle) px-2 py-px text-[11px] font-bold text-muted-foreground">
          {t('inbox.group.count', { count: group.count })}
        </span>
        <span className="sr-only">
          {open ? t('inbox.group.collapse') : t('inbox.group.expand')}
        </span>
      </button>

      {group.slaHours === null && cleanCount < 2 ? null : (
        <div className="flex items-center gap-2.5 pb-2 pl-[34px] pr-2.5">
          {group.slaHours === null ? null : (
            <AgeSpread
              className="min-w-0 flex-1"
              hours={group.ages}
              slaHours={group.slaHours}
              height={7}
            />
          )}
          {cleanCount >= 2 ? (
            <button
              type="button"
              disabled={onBatch === undefined}
              onClick={(event) => {
                event.stopPropagation();
                onBatch?.(group);
              }}
              className={cn(
                'shrink-0 whitespace-nowrap rounded-lg border-[1.5px] border-success-300 bg-success-50 px-2.5 py-0.5',
                'text-[11px] font-bold text-success-700 outline-none disabled:opacity-55',
                'focus-visible:ring-2 focus-visible:ring-ring',
                'dark:bg-success-700/15 dark:text-success-300',
              )}
            >
              {t('inbox.group.batch', { count: cleanCount })}
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}

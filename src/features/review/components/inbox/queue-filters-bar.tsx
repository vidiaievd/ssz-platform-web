'use client';

import { useTranslations } from 'next-intl';

import { Segmented } from '@/components/ui/segmented';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

import {
  REVIEWABLE_EXERCISE_TYPES,
  type ReviewQueueFacets,
  type ReviewQueueFilters,
  type ReviewableExerciseType,
} from '../../types';

const ALL = '__all__';

export interface QueueFiltersBarProps {
  filters: ReviewQueueFilters;
  facets: ReviewQueueFacets;
  onChange: (next: Partial<ReviewQueueFilters>) => void;
}

/**
 * Grouping and the four filters, in the order a teacher reaches for them.
 *
 * Grouping comes first and apart, because it is not a filter: it changes how the same work
 * is walked through, not how much of it there is. Marking is done in passes — the same
 * answer key, the same judgement, carried from one submission to the next — and switching
 * to the learner is for the other kind of session, the one before a conversation with a
 * particular person.
 *
 * "Longer than promised" is a toggle rather than a tab. A separate tab for late work is
 * how late work gets forgotten: it becomes somewhere else, and nobody goes there.
 */
export function QueueFiltersBar({ filters, facets, onChange }: QueueFiltersBarProps) {
  const t = useTranslations('Review');

  return (
    <div className="flex flex-col gap-3">
      <Segmented
        aria-label={t('inbox.groupBy.label')}
        value={filters.groupBy}
        onValueChange={(groupBy) => onChange({ groupBy })}
        size="sm"
        options={[
          { value: 'exercise', label: t('inbox.groupBy.exercise') },
          { value: 'student', label: t('inbox.groupBy.student') },
        ]}
      />

      <div className="flex flex-wrap items-center gap-1.5">
        <FacetSelect
          label={t('inbox.filter.group')}
          allLabel={t('inbox.filter.allGroups')}
          value={filters.group}
          options={facets.groups}
          onChange={(group) => onChange({ group })}
        />
        <FacetSelect
          label={t('inbox.filter.course')}
          allLabel={t('inbox.filter.allCourses')}
          value={filters.course}
          options={facets.courses}
          onChange={(course) => onChange({ course })}
        />
        <FacetSelect
          label={t('inbox.filter.type')}
          allLabel={t('inbox.filter.allTypes')}
          value={filters.type}
          options={REVIEWABLE_EXERCISE_TYPES.map((type) => ({ id: type, name: t(`type.${type}`) }))}
          onChange={(type) => onChange({ type: (type as ReviewableExerciseType) ?? null })}
        />

        <button
          type="button"
          aria-pressed={filters.overdueOnly}
          onClick={() => onChange({ overdueOnly: !filters.overdueOnly })}
          className={cn(
            'rounded-[9px] border-[1.5px] px-3 py-1.5 text-xs font-semibold transition-colors',
            'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 outline-none',
            filters.overdueOnly
              ? 'border-error bg-error/10 text-error'
              : 'border-border bg-background text-muted-foreground hover:text-foreground',
          )}
        >
          {t('inbox.filter.overdue')}
        </button>
      </div>
    </div>
  );
}

/**
 * A filter as a native-feeling select whose "all" is a value, not an empty string.
 *
 * Radix treats the empty string as "nothing chosen" and refuses it as an item value, so
 * the unfiltered state needs a sentinel of its own; it is translated back to `null` here
 * rather than leaking into the URL or the query key.
 */
function FacetSelect({
  label,
  allLabel,
  value,
  options,
  onChange,
}: {
  label: string;
  allLabel: string;
  value: string | null;
  options: { id: string; name: string }[];
  onChange: (value: string | null) => void;
}) {
  if (options.length === 0) return null;

  return (
    <Select value={value ?? ALL} onValueChange={(next) => onChange(next === ALL ? null : next)}>
      <SelectTrigger
        aria-label={label}
        size="sm"
        className={cn(
          'h-auto rounded-[9px] py-1.5 text-xs font-semibold',
          value === null && 'text-muted-foreground',
        )}
      >
        <SelectValue placeholder={allLabel} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{allLabel}</SelectItem>
        {options.map((option) => (
          <SelectItem key={option.id} value={option.id}>
            {option.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

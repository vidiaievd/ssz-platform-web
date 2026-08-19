'use client';

import { useTranslations } from 'next-intl';

import { Chip, Segment, Sel } from '../primitives';
import {
  REVIEWABLE_EXERCISE_TYPES,
  type ReviewQueueFacets,
  type ReviewQueueFilters,
  type ReviewableExerciseType,
} from '../../types';

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
      <Segment
        aria-label={t('inbox.groupBy.label')}
        value={filters.groupBy}
        onChange={(groupBy) => onChange({ groupBy })}
        options={[
          { value: 'exercise', label: t('inbox.groupBy.exercise') },
          { value: 'student', label: t('inbox.groupBy.student') },
        ]}
      />

      <div className="flex flex-wrap items-center gap-[7px]">
        <Sel
          label={t('inbox.filter.group')}
          allLabel={t('inbox.filter.allGroups')}
          value={filters.group}
          options={facets.groups.map((group) => ({ id: group.id, label: group.name }))}
          onChange={(group) => onChange({ group })}
        />
        <Sel
          label={t('inbox.filter.course')}
          allLabel={t('inbox.filter.allCourses')}
          value={filters.course}
          options={facets.courses.map((course) => ({ id: course.id, label: course.name }))}
          onChange={(course) => onChange({ course })}
        />
        <Sel
          label={t('inbox.filter.type')}
          allLabel={t('inbox.filter.allTypes')}
          value={filters.type}
          options={REVIEWABLE_EXERCISE_TYPES.map((type) => ({
            id: type,
            label: t(`type.${type}`),
          }))}
          onChange={(type) => onChange({ type: (type as ReviewableExerciseType) ?? null })}
        />

        <Chip
          active={filters.overdueOnly}
          onClick={() => onChange({ overdueOnly: !filters.overdueOnly })}
          tone="var(--color-error)"
        >
          {t('inbox.filter.overdue')}
        </Chip>
      </div>
    </div>
  );
}

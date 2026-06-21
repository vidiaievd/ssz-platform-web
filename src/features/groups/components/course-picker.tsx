'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Search, BookOpen } from 'lucide-react';

import { useAssignableCourses } from '../api/use-assignable-courses';

type Props = {
  onSelect: (courseId: string, courseName: string) => void;
  onCancel: () => void;
  /** Excluded from the list — already attached elsewhere on this group (main material + other additional materials). */
  excludeCourseIds?: string[];
  /** Shows a "No course" option that calls onSelect with empty values — only meaningful for the main material, which can be unset before first assignment. */
  allowNone?: boolean;
  onSelectNone?: () => void;
};

export function CoursePicker({ onSelect, onCancel, excludeCourseIds = [], allowNone = false, onSelectNone }: Props) {
  const t = useTranslations('Groups');
  const [query, setQuery] = useState('');
  const { data, isLoading } = useAssignableCourses({ search: query || undefined, pageSize: 20 });
  const containers = (data?.items ?? []).filter((c) => !excludeCourseIds.includes(c.id));

  return (
    <div className="flex flex-col gap-2 rounded-md border border-input p-2">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-(--ssz-text-muted)" aria-hidden="true" />
        <input
          type="search"
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('edit.courseSearchPlaceholder')}
          aria-label={t('edit.courseSearchPlaceholder')}
          className="h-9 w-full rounded-md border border-input bg-background pl-8 pr-3 text-sm placeholder:text-(--ssz-text-muted) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      <div role="listbox" aria-label={t('edit.course')} className="flex flex-col gap-1 max-h-48 overflow-y-auto">
        {allowNone && (
          <button
            type="button"
            role="option"
            aria-selected={false}
            onClick={onSelectNone}
            className="flex items-center gap-2 px-2 py-1.5 rounded-md text-left text-sm text-(--ssz-text-muted) hover:bg-muted/50"
          >
            {t('edit.courseNoneOption')}
          </button>
        )}

        {isLoading && (
          <p className="text-sm text-(--ssz-text-muted) text-center py-3">{t('edit.courseLoading')}</p>
        )}

        {!isLoading && containers.map((c) => (
          <button
            key={c.id}
            type="button"
            role="option"
            aria-selected={false}
            onClick={() => onSelect(c.id, c.title)}
            className="flex items-center gap-2 px-2 py-1.5 rounded-md text-left hover:bg-muted/50"
          >
            <BookOpen className="size-3.5 text-(--ssz-text-muted) shrink-0" aria-hidden="true" />
            <span className="text-sm text-(--ssz-text-primary) truncate">{c.title}</span>
          </button>
        ))}

        {!isLoading && containers.length === 0 && (
          <p className="text-sm text-(--ssz-text-muted) text-center py-3">{t('edit.courseNoResults')}</p>
        )}
      </div>

      <button
        type="button"
        onClick={onCancel}
        className="self-end text-xs font-semibold text-(--ssz-text-muted) hover:underline"
      >
        {t('edit.cancel')}
      </button>
    </div>
  );
}

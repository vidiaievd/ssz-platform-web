'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Search, BookOpen, X } from 'lucide-react';

import { useAssignableCourses } from '../api/use-assignable-courses';

type Props = {
  courseId: string | null;
  courseName: string | null;
  onChange: (courseId: string | null, courseName: string | null) => void;
};

export function GroupEditCourseField({ courseId, courseName, onChange }: Props) {
  const t = useTranslations('Groups');
  const [pickerOpen, setPickerOpen] = useState(false);

  if (pickerOpen) {
    return (
      <CoursePicker
        onSelect={(id, name) => {
          onChange(id, name);
          setPickerOpen(false);
        }}
        onCancel={() => setPickerOpen(false)}
      />
    );
  }

  if (courseId) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-md border border-input px-3 py-2">
        <div className="flex items-center gap-2 min-w-0">
          <BookOpen className="size-3.5 text-(--ssz-text-muted) shrink-0" aria-hidden="true" />
          <span className="text-sm font-medium text-(--ssz-text-secondary) truncate">{courseName}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="text-xs font-semibold text-primary-600 dark:text-primary-400 hover:underline"
          >
            {t('edit.courseChange')}
          </button>
          <button
            type="button"
            onClick={() => onChange(null, null)}
            aria-label={t('edit.courseRemove')}
            className="inline-flex items-center justify-center size-6 rounded-sm text-(--ssz-text-muted) hover:text-error-600"
          >
            <X className="size-3.5" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setPickerOpen(true)}
      className="flex items-center justify-center gap-1.5 rounded-md border border-dashed border-input px-3 py-2 text-sm font-medium text-(--ssz-text-muted) hover:border-primary hover:text-primary"
    >
      <BookOpen className="size-3.5" aria-hidden="true" />
      {t('edit.courseAdd')}
    </button>
  );
}

function CoursePicker({
  onSelect,
  onCancel,
}: {
  onSelect: (courseId: string | null, courseName: string | null) => void;
  onCancel: () => void;
}) {
  const t = useTranslations('Groups');
  const [query, setQuery] = useState('');
  const { data, isLoading } = useAssignableCourses({ search: query || undefined, pageSize: 20 });
  const containers = data?.items ?? [];

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
        <button
          type="button"
          role="option"
          aria-selected={false}
          onClick={() => onSelect(null, null)}
          className="flex items-center gap-2 px-2 py-1.5 rounded-md text-left text-sm text-(--ssz-text-muted) hover:bg-muted/50"
        >
          {t('edit.courseNoneOption')}
        </button>

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

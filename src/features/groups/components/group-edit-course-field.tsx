'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { BookOpen } from 'lucide-react';

import { CoursePicker } from './course-picker';

type Props = {
  courseId: string | null;
  courseName: string | null;
  /** Already attached as an additional material — can't also become the main material. */
  excludeCourseIds?: string[];
  onChange: (courseId: string, courseName: string) => void;
};

/**
 * Main material picker. Unlike additional materials, this can be reassigned
 * but never cleared back to "no course" once set (enforced server-side too —
 * see UpdateSchoolGroupHandler) — so there's no remove control here, only
 * "Add" (first assignment) or "Change" (reassign).
 */
export function GroupEditCourseField({ courseId, courseName, excludeCourseIds, onChange }: Props) {
  const t = useTranslations('Groups');
  const [pickerOpen, setPickerOpen] = useState(false);

  if (pickerOpen) {
    return (
      <CoursePicker
        excludeCourseIds={excludeCourseIds}
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
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="text-xs font-semibold text-primary-600 dark:text-primary-400 hover:underline shrink-0"
        >
          {t('edit.courseChange')}
        </button>
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

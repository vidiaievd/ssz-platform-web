'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { Eye } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Alert } from '@/components/ui/alert';
import { useSchoolWritable } from '@/features/school-lifecycle';

/**
 * The course editor opened for viewing (plan 90, Q17 (a)): the caller may not edit this course —
 * the school is suspended or closed, or they have no edit right (a teacher on a school course).
 * Every control that changes the course reads this and is not drawn; what stays is the course to
 * look at. Like `useCan()`, only the screen follows it — content-service refuses the write anyway.
 *
 * `false` outside a provider: a builder mounted on its own edits as before.
 */
const CourseReadOnlyContext = createContext(false);

export function CourseReadOnlyProvider({ readOnly, children }: { readOnly: boolean; children: ReactNode }) {
  return <CourseReadOnlyContext.Provider value={readOnly}>{children}</CourseReadOnlyContext.Provider>;
}

export function useCourseReadOnly(): boolean {
  return useContext(CourseReadOnlyContext);
}

/**
 * Says the course is open for viewing, and why. In a suspended or closed workspace that is the
 * school's status (the workspace banner above says when it ends) — never "you may not edit",
 * which would wrongly point an owner at their own rights.
 */
export function CourseReadOnlyNotice({ className }: { className?: string }) {
  const t = useTranslations('Authoring.readOnly');
  const writable = useSchoolWritable();
  if (!useCourseReadOnly()) return null;
  return (
    <Alert
      variant="info"
      icon={<Eye className="h-4 w-4" aria-hidden />}
      title={t('title')}
      className={className}
      data-testid="course-read-only"
    >
      {writable ? t('noRight') : t('school')}
    </Alert>
  );
}

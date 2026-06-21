'use client';

import { useTranslations } from 'next-intl';

import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter,
} from '@/components/ui/sheet';
import { ChangeCourseDialog } from './change-course-dialog';
import type { CourseView } from '../types';

type Props = {
  courseView: CourseView;
  canManage: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function CoursePanel({ courseView, canManage, open, onOpenChange }: Props) {
  const t = useTranslations('Groups');

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{courseView.courseName ?? t('course.title')}</SheetTitle>
          <SheetDescription>{t('course.description')}</SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-3 px-4 py-2 flex-1 overflow-y-auto">
          {courseView.courseId == null ? (
            <p className="text-sm text-(--ssz-text-muted) italic">{t('course.noCourse')}</p>
          ) : (
            <dl className="flex flex-col gap-2 text-sm">
              <div className="flex items-center justify-between gap-2">
                <dt className="text-(--ssz-text-muted)">{t('course.cefr')}</dt>
                <dd className="font-medium text-(--ssz-text-secondary)">{courseView.level}</dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-(--ssz-text-muted)">{t('course.language')}</dt>
                <dd className="font-medium text-(--ssz-text-secondary)">{courseView.lang.toUpperCase()}</dd>
              </div>
              {courseView.unitCount !== null && (
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-(--ssz-text-muted)">{t('course.curriculum')}</dt>
                  <dd className="font-medium text-(--ssz-text-secondary)">
                    {t('course.units', { count: courseView.unitCount })}
                  </dd>
                </div>
              )}
            </dl>
          )}

          {/* Seam for future "Attached content" (spec §6.3) — no data model yet; out of scope. */}
        </div>

        {canManage && (
          <SheetFooter>
            <div className="flex items-center justify-end">
              <ChangeCourseDialog />
            </div>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
}

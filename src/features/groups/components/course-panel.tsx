'use client';

import { useTranslations } from 'next-intl';

import { BookOpen } from 'lucide-react';

import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter,
} from '@/components/ui/sheet';
import type { CourseView, GroupMaterial } from '../types';

type Props = {
  courseView: CourseView;
  canManage: boolean;
  materials: GroupMaterial[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function CoursePanel({ courseView, canManage, materials, open, onOpenChange }: Props) {
  const t = useTranslations('Groups');

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="data-[side=right]:w-full data-[side=right]:max-w-none sm:data-[side=right]:max-w-sm xl:data-[side=right]:max-w-120">
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

          <div className="flex flex-col gap-2 pt-2 border-t border-border/60">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-(--ssz-text-muted)">
              {t('edit.materialsHeading')}
            </h3>
            {materials.length === 0 ? (
              <p className="text-sm text-(--ssz-text-muted) italic">{t('edit.noMaterials')}</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {materials.map((material) => (
                  <li
                    key={material.id}
                    className="flex items-center gap-2 rounded-md border border-input px-3 py-2"
                  >
                    <BookOpen className="size-3.5 text-(--ssz-text-muted) shrink-0" aria-hidden="true" />
                    <span className="text-sm font-medium text-(--ssz-text-secondary) truncate">
                      {material.courseName}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {canManage && (
          <SheetFooter>
            <p className="text-xs text-(--ssz-text-muted) text-center sm:text-left">
              {t('course.editHint')}
            </p>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
}

'use client';

import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet';
import type { CourseView } from '../types';

type Props = {
  courseView: CourseView;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function CoursePanel({ courseView, open, onOpenChange }: Props) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{courseView.courseName ?? 'Course'}</SheetTitle>
          <SheetDescription>Read-only course details for this group.</SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-3 px-4 py-2 flex-1 overflow-y-auto">
          {courseView.courseId == null ? (
            <p className="text-sm text-(--ssz-text-muted) italic">No course assigned</p>
          ) : (
            <dl className="flex flex-col gap-2 text-sm">
              <div className="flex items-center justify-between gap-2">
                <dt className="text-(--ssz-text-muted)">CEFR level</dt>
                <dd className="font-medium text-(--ssz-text-secondary)">{courseView.level}</dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-(--ssz-text-muted)">Language</dt>
                <dd className="font-medium text-(--ssz-text-secondary)">{courseView.lang.toUpperCase()}</dd>
              </div>
              {courseView.unitCount !== null && (
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-(--ssz-text-muted)">Curriculum</dt>
                  <dd className="font-medium text-(--ssz-text-secondary)">{courseView.unitCount} units</dd>
                </div>
              )}
            </dl>
          )}

          {/* Seam for future "Attached content" (spec §6.3) — no data model yet; out of scope. */}
        </div>
      </SheetContent>
    </Sheet>
  );
}

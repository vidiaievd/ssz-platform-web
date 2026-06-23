'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { GroupEditCourseField } from './group-edit-course-field';
import { GroupEditMaterialsField } from './group-edit-materials-field';
import { updateGroup, removeGroupMaterial } from '../api/mutations';
import type { Group } from '../types';

type Props = {
  group: Group;
  schoolId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * Standalone "manage course" popup — same Dialog styling as GroupEditDialog,
 * but scoped to just the main course + additional materials so it's reachable
 * directly from the Course card instead of being buried in the full group edit form.
 */
export function CourseManageDialog({ group, schoolId, open, onOpenChange }: Props) {
  const t = useTranslations('Groups');
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [courseId, setCourseId] = useState(group.courseId);
  const [courseName, setCourseName] = useState(group.courseName ?? null);

  const isDirty = courseId !== group.courseId;

  function handleClose(next: boolean) {
    if (!next) {
      setCourseId(group.courseId);
      setCourseName(group.courseName ?? null);
    }
    onOpenChange(next);
  }

  function handleSave() {
    if (!courseId || !isDirty) return;
    startTransition(async () => {
      const result = await updateGroup(schoolId, group.id, { courseId });
      if (!result.ok) {
        toast.error(t('course.updateError'));
        return;
      }
      // Promote: a course picked as the main material no longer needs to
      // also be listed as an additional one.
      const promoted = group.materials.find((m) => m.courseId === courseId);
      if (promoted) {
        await removeGroupMaterial(schoolId, group.id, promoted.id);
      }
      toast.success(t('course.updateSuccess'));
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('course.dialogTitle')}</DialogTitle>
          <DialogDescription>{t('course.dialogDescription')}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-5 py-2">
          <fieldset className="flex flex-col gap-2">
            <legend className="text-xs font-semibold uppercase tracking-wide text-(--ssz-text-muted) mb-1">
              {t('edit.course')}
            </legend>
            <GroupEditCourseField
              courseId={courseId}
              courseName={courseName}
              onChange={(id, name) => {
                setCourseId(id);
                setCourseName(name);
              }}
            />
          </fieldset>

          <fieldset className="flex flex-col gap-2">
            <legend className="text-xs font-semibold uppercase tracking-wide text-(--ssz-text-muted) mb-1">
              {t('edit.materialsHeading')}
            </legend>
            <GroupEditMaterialsField
              schoolId={schoolId}
              groupId={group.id}
              materials={group.materials}
              mainCourseId={courseId}
            />
          </fieldset>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)} disabled={isPending}>
            {t('edit.cancel')}
          </Button>
          <Button onClick={handleSave} disabled={isPending || !isDirty}>
            {isPending ? t('edit.saving') : t('edit.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { BookOpen, X } from 'lucide-react';
import { toast } from 'sonner';

import { CoursePicker } from './course-picker';
import { addGroupMaterial, removeGroupMaterial } from '../api/mutations';
import type { GroupMaterial } from '../types';

type Props = {
  schoolId: string;
  groupId: string;
  materials: GroupMaterial[];
  /** Main material's courseId, if set — can't also be added as an additional material. */
  mainCourseId: string | null;
  /** Hides add/remove controls for viewers without manage rights. */
  canManage?: boolean;
};

/**
 * Additional materials: freely added/removed, independent of the main
 * material and of the dialog's Save button — mirrors TeacherRow's immediate
 * remove action (teacher-row.tsx) rather than the form's batched submit.
 */
export function GroupEditMaterialsField({ schoolId, groupId, materials, mainCourseId, canManage = true }: Props) {
  const t = useTranslations('Groups');
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [pickerOpen, setPickerOpen] = useState(false);

  const excludeCourseIds = [
    ...(mainCourseId ? [mainCourseId] : []),
    ...materials.map((m) => m.courseId),
  ];

  function handleAdd(courseId: string) {
    startTransition(async () => {
      const result = await addGroupMaterial(schoolId, groupId, courseId);
      if (result.ok) {
        setPickerOpen(false);
        router.refresh();
      } else {
        toast.error(t('edit.materialAddError'));
      }
    });
  }

  function handleRemove(materialId: string) {
    startTransition(async () => {
      const result = await removeGroupMaterial(schoolId, groupId, materialId);
      if (result.ok) {
        router.refresh();
      } else {
        toast.error(t('edit.materialRemoveError'));
      }
    });
  }

  return (
    <div className="flex flex-col gap-2">
      {materials.length === 0 && !pickerOpen && (
        <p className="text-sm text-(--ssz-text-muted) italic">{t('edit.noMaterials')}</p>
      )}

      {materials.map((material) => (
        <div
          key={material.id}
          className="flex items-center justify-between gap-2 rounded-md border border-input px-3 py-2"
        >
          <div className="flex items-center gap-2 min-w-0">
            <BookOpen className="size-3.5 text-(--ssz-text-muted) shrink-0" aria-hidden="true" />
            <span className="text-sm font-medium text-(--ssz-text-secondary) truncate">
              {material.courseName}
            </span>
          </div>
          {canManage && (
            <button
              type="button"
              onClick={() => handleRemove(material.id)}
              disabled={isPending}
              aria-label={t('edit.removeMaterial')}
              className="inline-flex items-center justify-center size-6 rounded-sm text-(--ssz-text-muted) hover:text-error-600 disabled:opacity-50 shrink-0"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
      ))}

      {canManage && (
        pickerOpen ? (
          <CoursePicker
            excludeCourseIds={excludeCourseIds}
            onSelect={(id) => handleAdd(id)}
            onCancel={() => setPickerOpen(false)}
          />
        ) : (
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            disabled={isPending}
            className="flex items-center justify-center gap-1.5 rounded-md border border-dashed border-input px-3 py-2 text-sm font-medium text-(--ssz-text-muted) hover:border-primary hover:text-primary disabled:opacity-50"
          >
            <BookOpen className="size-3.5" aria-hidden="true" />
            {t('edit.addMaterial')}
          </button>
        )
      )}
    </div>
  );
}

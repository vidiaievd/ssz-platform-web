'use client';

import Link from 'next/link';
import { Plus, AlertCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { TeacherRow } from './teacher-row';
import type { GroupTeacher } from '../types';

type Props = {
  teachers: GroupTeacher[];
  schoolId: string;
  groupId: string;
  assignTeacherHref: string;
};

// Spec: docs/design/design_handoff_group_management_hifi/Group-Management-Implementation-Spec.md
// §5 GroupDetail / Teachers, §12.5 TEACHERS TAB — one card: section head (title + role
// rules + Assign teacher) then primary/co-primary/substitutes in a single column, each
// absence spelled out as a line rather than the section just disappearing.
export function GroupTeachersTab({ teachers, schoolId, groupId, assignTeacherHref }: Props) {
  const t = useTranslations('Groups');
  const primary = teachers.find((gt) => gt.role === 'primary');
  const coPrimary = teachers.find((gt) => gt.role === 'co-primary');
  const substitutes = teachers.filter((gt) => gt.role === 'substitute');

  return (
    <div className="rounded-lg border-[1.5px] border-(--ssz-border-default) bg-card p-5">
      <div className="flex items-end justify-between gap-3 mb-3.5">
        <div>
          <h2 className="text-[15px] font-bold tracking-[-0.01em] text-(--ssz-text-primary)">
            {t('teachers.assignedHeading')}
          </h2>
          <p className="mt-0.75 text-[12.5px] text-(--ssz-text-muted)">
            {t('teachers.assignedSub')}
          </p>
        </div>
        <Button size="sm" asChild>
          <Link href={assignTeacherHref}>
            <Plus className="size-3.5 mr-1.5" aria-hidden="true" />
            {t('teachers.assignTeacher')}
          </Link>
        </Button>
      </div>

      <div className="flex flex-col gap-2.5">
        {primary ? (
          <TeacherRow teacher={primary} schoolId={schoolId} groupId={groupId} canRemove />
        ) : (
          <div className="flex items-center gap-3 rounded-lg border border-error-200 bg-error-50 dark:border-error-800 dark:bg-error-900/20 px-4 py-3">
            <AlertCircle className="size-4 text-error-500 shrink-0" aria-hidden="true" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-error-700 dark:text-error-300">
                {t('teachers.noPrimary')}
              </p>
              <p className="text-xs text-error-600/70 dark:text-error-400/70">
                {t('teachers.noPrimaryDescription')}
              </p>
            </div>
            <Button size="sm" asChild>
              <Link href={assignTeacherHref}>{t('teachers.assignPrimary')}</Link>
            </Button>
          </div>
        )}

        {coPrimary ? (
          <TeacherRow teacher={coPrimary} schoolId={schoolId} groupId={groupId} canRemove />
        ) : (
          <p className="text-[13px] text-(--ssz-text-muted)">{t('teachers.noCoPrimary')}</p>
        )}

        <p className="mt-1.5 text-[10.5px] font-bold uppercase tracking-wide text-(--ssz-text-muted)">
          {t('teachers.subsHeading')}
        </p>
        {substitutes.length > 0 ? (
          substitutes.map((gt) => (
            <TeacherRow key={gt.userId} teacher={gt} schoolId={schoolId} groupId={groupId} canRemove />
          ))
        ) : (
          <p className="text-[13px] text-(--ssz-text-muted)">{t('teachers.noSubstitutes')}</p>
        )}
      </div>
    </div>
  );
}

'use client';

import Link from 'next/link';
import { UserPlus, AlertCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { TeacherRow } from './teacher-row';
import type { GroupTeacher } from '../types';

type Props = {
  teachers: GroupTeacher[];
  schoolId: string;
  groupId: string;
  assignTeacherHref: string;
};

export function GroupTeachersTab({ teachers, schoolId, groupId, assignTeacherHref }: Props) {
  const primary    = teachers.find((t) => t.role === 'primary');
  const coPrimary  = teachers.find((t) => t.role === 'co-primary');
  const substitutes = teachers.filter((t) => t.role === 'substitute');

  return (
    <div className="space-y-5">
      {/* Primary teacher */}
      <section aria-labelledby="teacher-primary-heading">
        <div className="flex items-center justify-between mb-2">
          <h3 id="teacher-primary-heading" className="text-xs font-semibold uppercase tracking-wide text-(--ssz-text-muted)">
            Primary teacher
          </h3>
          <Button variant="ghost" size="sm" asChild>
            <Link href={assignTeacherHref}>
              <UserPlus className="size-3.5 mr-1.5" aria-hidden="true" />
              Assign teacher
            </Link>
          </Button>
        </div>

        {primary ? (
          <TeacherRow teacher={primary} schoolId={schoolId} groupId={groupId} canRemove />
        ) : (
          <div className="flex items-center gap-3 rounded-lg border border-error-200 bg-error-50 dark:border-error-800 dark:bg-error-900/20 px-4 py-3">
            <AlertCircle className="size-4 text-error-500 shrink-0" aria-hidden="true" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-error-700 dark:text-error-300">
                No primary teacher
              </p>
              <p className="text-xs text-error-600/70 dark:text-error-400/70">
                This group cannot run lessons without a primary teacher.
              </p>
            </div>
            <Button size="sm" asChild>
              <Link href={assignTeacherHref}>Assign primary</Link>
            </Button>
          </div>
        )}
      </section>

      {/* Co-primary teacher */}
      <section aria-labelledby="teacher-coprimary-heading">
        <h3 id="teacher-coprimary-heading" className="text-xs font-semibold uppercase tracking-wide text-(--ssz-text-muted) mb-2">
          Co-primary teacher
        </h3>
        {coPrimary ? (
          <TeacherRow teacher={coPrimary} schoolId={schoolId} groupId={groupId} canRemove />
        ) : (
          <p className="text-sm text-(--ssz-text-muted) italic px-3 py-2">
            No co-primary teacher assigned.
          </p>
        )}
      </section>

      {/* Substitutes */}
      {substitutes.length > 0 && (
        <section aria-labelledby="teacher-subs-heading">
          <h3 id="teacher-subs-heading" className="text-xs font-semibold uppercase tracking-wide text-(--ssz-text-muted) mb-2">
            Substitutes
          </h3>
          <div className="flex flex-col gap-2">
            {substitutes.map((t) => (
              <TeacherRow key={t.userId} teacher={t} schoolId={schoolId} groupId={groupId} canRemove />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

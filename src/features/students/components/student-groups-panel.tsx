import Link from 'next/link';
import { ChevronRight, UserX } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { studentTeachers } from '@/lib/students/status';
import type { StudentDetail, TeacherRef } from '@/features/students/types';
import { RemoveFromGroupButton } from './remove-from-group-button';

type Props = {
  student: StudentDetail;
  schoolId: string;
  schoolSlug: string;
  addToGroupHref: string;
};

function TeacherStack({ teachers }: { teachers: TeacherRef[] }) {
  if (teachers.length === 0) {
    return (
      <span className="flex items-center gap-1 text-xs text-red-600 dark:text-red-400">
        <UserX className="h-3.5 w-3.5" aria-hidden />
        No teacher
      </span>
    );
  }

  return (
    <div className="flex -space-x-1.5">
      {teachers.slice(0, 3).map((t) => (
        <Avatar
          key={t.userId}
          src={t.avatarUrl ?? undefined}
          name={t.name}
          size="sm"
          className="ring-2 ring-background"
          title={`${t.name} (${t.role})`}
        />
      ))}
      {teachers.length > 3 && (
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-xs font-medium ring-2 ring-background">
          +{teachers.length - 3}
        </span>
      )}
    </div>
  );
}

export async function StudentGroupsPanel({ student, schoolId, schoolSlug, addToGroupHref }: Props) {
  const t = await getTranslations('Students');
  const allTeachers = studentTeachers(student.groups);

  if (student.groups.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-6">
        <h2 className="text-base font-semibold mb-4">{t('detail.groups')}</h2>
        <div className="flex flex-col items-center gap-4 py-8 text-center">
          <p className="text-sm text-muted-foreground">{t('detail.notInAnyGroup')}</p>
          <Button size="sm" asChild>
            <Link href={addToGroupHref}>{t('detail.addToGroup')}</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card p-6 space-y-4">
      <h2 className="text-base font-semibold">{t('detail.groups')}</h2>

      <div className="space-y-3">
        {student.groups.map((g) => {
          const groupTeachers = g.teachers ?? [];
          return (
            <div key={g.id} className="flex items-center gap-3 rounded-lg border p-3">
              {/* Lang/level tile */}
              <div className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-md bg-primary/10 text-primary">
                <span className="text-xs font-bold leading-none">{g.lang.toUpperCase()}</span>
                <span className="text-xs">{g.level}</span>
              </div>

              {/* Name + schedule */}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{g.name}</p>
                {g.scheduleSummary && (
                  <p className="text-xs text-muted-foreground">{g.scheduleSummary}</p>
                )}
              </div>

              {/* Teacher stack */}
              <TeacherStack teachers={groupTeachers as TeacherRef[]} />

              {/* Link to group */}
              <Link
                href={`/school/${schoolSlug}/groups/${g.id}`}
                className="rounded p-1 hover:bg-accent transition-colors"
                aria-label={t('detail.openGroup', { name: g.name })}
              >
                <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden />
              </Link>

              {/* Remove */}
              <RemoveFromGroupButton
                schoolId={schoolId}
                groupId={g.id}
                userId={student.userId}
                groupName={g.name}
              />
            </div>
          );
        })}
      </div>

      {/* Footer — distinct inherited teachers */}
      {allTeachers.length > 0 && (
        <div className="border-t pt-3 flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{t('detail.teachers')}:</span>
          <div className="flex flex-wrap gap-1">
            {allTeachers.map((t) => (
              <Badge key={t.userId} variant="muted" className="text-xs font-normal">
                {t.name}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

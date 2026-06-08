import { AlertTriangle } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

import { Avatar } from '@/components/ui/avatar';
import { Alert } from '@/components/ui/alert';
import { StatusChip } from './status-chip';
import type { StudentDetail as StudentDetailType } from '@/features/students/types';
import { StudentNudgeButton } from './student-nudge-button';

type Props = {
  student: StudentDetailType;
  schoolId: string;
  addToGroupHref: string;
};

export async function StudentDetailHeader({ student, schoolId, addToGroupHref }: Props) {
  const t = await getTranslations('Students');

  return (
    <div className="space-y-4">
      {/* Clash banner */}
      {student.clashes.length > 0 && (
        <Alert
          variant="error"
          role="alert"
          aria-live="polite"
          icon={<AlertTriangle className="h-4 w-4" aria-hidden />}
        >
          <div className="space-y-1">
            {student.clashes.map((c, i) => (
              <p key={i} className="text-sm">
                {t('detail.clashBanner', {
                  groupA: c.groupA,
                  groupB: c.groupB,
                  day: c.day,
                  time: c.time,
                })}
              </p>
            ))}
          </div>
        </Alert>
      )}

      {/* Header card */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-xl border bg-card p-4 sm:p-6">
        <div className="flex items-center gap-4">
          <Avatar
            src={student.avatarUrl ?? undefined}
            name={student.name}
            size="xl"
            className="shrink-0"
          />
          <div className="min-w-0 space-y-1">
            <h1 className="text-xl font-semibold leading-none truncate">{student.name}</h1>
            <p className="text-sm text-muted-foreground truncate">{student.email}</p>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <StatusChip status={student.status} />
              <span className="text-xs text-muted-foreground">
                {student.lang.toUpperCase()} · {student.level}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 sm:flex-col sm:items-end lg:flex-row">
          <StudentNudgeButton schoolId={schoolId} userId={student.userId} studentName={student.name} />
          <a
            href={addToGroupHref}
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium shadow-sm hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            {t('detail.addToGroup')}
          </a>
        </div>
      </div>
    </div>
  );
}

import { AlertTriangle } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Link } from '@/lib/i18n/navigation';

import { Button } from '@/components/ui/button';
import { wsHref } from '@/features/workspaces/lib/href';

type OperationsBannerProps = {
  conflictCount: number;
  noTeacherCount: number;
  workspaceId: string;
};

export function OperationsBanner({ conflictCount, noTeacherCount, workspaceId }: OperationsBannerProps) {
  const t = useTranslations('School.dashboard.operations');
  if (conflictCount === 0 && noTeacherCount === 0) return null;

  const parts: string[] = [];
  if (conflictCount > 0) parts.push(t('conflicts', { count: conflictCount }));
  if (noTeacherCount > 0) parts.push(t('noTeacher', { count: noTeacherCount }));
  const problems = parts.length === 2 ? t('both', { first: parts[0]!, second: parts[1]! }) : parts[0]!;
  // The verb agrees with the subject: one kind of problem takes its own number («1 група … заважає»,
  // «5 груп … заважають»), two kinds joined by «і» always take the plural.
  const n = parts.length === 2 ? 2 : conflictCount || noTeacherCount;

  const groupsHref = wsHref(workspaceId, 'groups');

  return (
    <div
      role="alert"
      className="flex flex-col gap-3 rounded-lg border border-error-300 bg-error-50 p-4 dark:border-error-800 dark:bg-error-950/40 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex items-start gap-3">
        <AlertTriangle
          className="mt-0.5 size-5 shrink-0 text-error-600 dark:text-error-400"
          aria-hidden="true"
        />
        <p className="text-sm text-error-800 dark:text-error-300">
          {t.rich('body', { n, problems, b: (chunks) => <strong>{chunks}</strong> })}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-2 pl-8 sm:pl-0">
        <Button variant="ghost" size="sm" asChild className="text-error-700 hover:text-error-900 dark:text-error-400">
          <Link href={`${groupsHref}/timetable`}>{t('timetable')}</Link>
        </Button>
        <Button size="sm" asChild className="bg-error-600 hover:bg-error-700 text-white dark:bg-error-700 dark:hover:bg-error-600">
          <Link href={groupsHref}>{t('reviewGroups')}</Link>
        </Button>
      </div>
    </div>
  );
}

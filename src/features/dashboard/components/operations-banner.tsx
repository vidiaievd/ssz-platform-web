import { AlertTriangle } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';

type OperationsBannerProps = {
  conflictCount: number;
  noTeacherCount: number;
  schoolSlug: string;
};

export function OperationsBanner({ conflictCount, noTeacherCount, schoolSlug }: OperationsBannerProps) {
  if (conflictCount === 0 && noTeacherCount === 0) return null;

  const parts: string[] = [];
  if (conflictCount > 0) {
    parts.push(`${conflictCount} scheduling ${conflictCount === 1 ? 'conflict' : 'conflicts'}`);
  }
  if (noTeacherCount > 0) {
    parts.push(`${noTeacherCount} ${noTeacherCount === 1 ? 'group' : 'groups'} with no teacher`);
  }

  const groupsHref = `/school/${schoolSlug}/groups`;

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
          <strong>{parts.join(' and ')}</strong> block lessons from running safely.
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-2 pl-8 sm:pl-0">
        <Button variant="ghost" size="sm" asChild className="text-error-700 hover:text-error-900 dark:text-error-400">
          <Link href={`${groupsHref}/timetable`}>Teacher timetable</Link>
        </Button>
        <Button size="sm" asChild className="bg-error-600 hover:bg-error-700 text-white dark:bg-error-700 dark:hover:bg-error-600">
          <Link href={groupsHref}>Review groups</Link>
        </Button>
      </div>
    </div>
  );
}

import { Users } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

import { getSchoolSeats } from '../api/get-school-seats';
import type { SeatState } from '../types';

const TONE: Record<SeatState, string> = {
  ok: 'border-border bg-muted/40 text-muted-foreground',
  warning:
    'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800/50 dark:bg-amber-900/20 dark:text-amber-300',
  full: 'border-red-200 bg-red-50 text-red-800 dark:border-red-800/50 dark:bg-red-900/20 dark:text-red-300',
};

/**
 * "87 / 100 seats" for the roster, invitation and request screens (plan 90, phase 4). Yellow
 * inside the 10 % grace, red at the ceiling with the way out. Renders nothing for a school
 * without a limit, or when the number is unavailable. A server component: a refresh after an
 * action re-reads it.
 */
export async function SeatsBadge({ schoolId }: { schoolId: string }) {
  const seats = await getSchoolSeats(schoolId);
  if (!seats || seats.limit === null) return null;

  const t = await getTranslations('Students.seats');
  return (
    <div
      role="status"
      data-state={seats.state}
      className={`inline-flex flex-wrap items-center gap-x-2 gap-y-0.5 rounded-md border px-3 py-1.5 text-sm font-medium ${TONE[seats.state]}`}
    >
      <Users className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>{t('count', { used: seats.used, limit: seats.limit })}</span>
      {seats.state === 'warning' ? <span className="font-normal">{t('warning', { ceiling: seats.ceiling ?? seats.limit })}</span> : null}
      {seats.state === 'full' ? <span className="font-normal">{t('full')}</span> : null}
    </div>
  );
}

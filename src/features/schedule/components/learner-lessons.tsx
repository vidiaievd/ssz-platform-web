import Link from 'next/link';
import { CalendarClock } from 'lucide-react';
import { getFormatter, getTranslations } from 'next-intl/server';

import { wsHref } from '@/features/workspaces/lib/href';
import { getMySchedule } from '../api/get-my-schedule';
import { isoDay } from '../lib/range';

type Props = {
  workspaceId: string;
  /** The groups this learner is in; their lessons are the sessions of those. */
  groupIds: string[];
  /** How far ahead to look, in days. */
  days?: number;
  limit?: number;
};

/**
 * The next few lessons with one learner, on their own card.
 *
 * The week answers "what am I teaching"; this answers "when do I next see them", which is
 * the question the card is open for. Same sessions, same source — a second reading of the
 * schedule would eventually disagree with it (plan 62, phase 8).
 */
export async function LearnerLessons({ workspaceId, groupIds, days = 60, limit = 3 }: Props) {
  if (groupIds.length === 0) return null;

  const [t, format] = await Promise.all([
    getTranslations('Scheduling.my.learner'),
    getFormatter(),
  ]);

  const today = new Date();
  const { sessions, error } = await getMySchedule(workspaceId, {
    from: isoDay(today),
    to: isoDay(new Date(today.getTime() + days * 86_400_000)),
  });

  if (error) return null;

  const theirs = sessions
    .filter((session) => groupIds.includes(session.groupId) && session.status !== 'cancelled')
    .slice(0, limit);

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <CalendarClock className="size-4 text-muted-foreground" aria-hidden />
          {t('title')}
        </h2>
        <Link
          href={wsHref(workspaceId, 'schedule')}
          className="rounded text-xs font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {t('all')}
        </Link>
      </div>

      {theirs.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('none', { days })}</p>
      ) : (
        <ul role="list" className="divide-y divide-border">
          {theirs.map((session) => (
            <li key={session.id} className="flex items-baseline gap-3 py-2 text-sm">
              <span className="w-28 shrink-0 text-muted-foreground">
                {format.dateTime(new Date(`${session.date}T00:00:00.000Z`), {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
                  timeZone: 'UTC',
                })}
              </span>
              <span className="w-24 shrink-0 tabular-nums text-muted-foreground">
                {session.start}–{session.end}
              </span>
              <span className="min-w-0 flex-1 truncate">
                {session.topicTitle ?? t('noTopic')}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

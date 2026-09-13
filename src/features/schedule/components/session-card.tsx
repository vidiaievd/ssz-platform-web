import Link from 'next/link';
import { Clock } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

import { wsHref } from '@/features/workspaces/lib/href';
import { SessionActions } from './session-actions';
import type { ScheduleSession } from '../api/get-my-schedule';

type Props = {
  session: ScheduleSession;
  workspaceId: string;
};

const TONE: Record<string, string> = {
  held: 'border-success-300 bg-success-50 dark:border-success-800 dark:bg-success-950/40',
  cancelled: 'border-border bg-muted/40 opacity-70',
  moved: 'border-warning-300 bg-warning-50 dark:border-warning-800 dark:bg-warning-950/40',
  scheduled: 'border-border bg-card',
};

/**
 * One lesson in the week: when, with whom, and what it teaches.
 *
 * A cancelled lesson is drawn struck through rather than dropped — it is a fact about the
 * week, and a tutor looking for a gap needs to see where one opened.
 */
export async function SessionCard({ session, workspaceId }: Props) {
  const t = await getTranslations('Scheduling.my');
  const cancelled = session.status === 'cancelled';

  return (
    <div
      className={`rounded-lg border p-2.5 transition-colors focus-within:ring-2 focus-within:ring-ring ${TONE[session.status] ?? TONE.scheduled}`}
    >
      <div className="flex items-center gap-1.5 text-xs font-medium text-(--ssz-text-muted)">
        <Clock className="size-3" aria-hidden="true" />
        <span className="tabular-nums">
          {session.start}–{session.end}
        </span>
        {/* Colour alone cannot say "held": the same card has to read in monochrome, and a
            tutor scanning the week is looking for exactly this word. */}
        <span className="ml-auto flex items-center gap-1.5">
          {session.type === 'exam' && <span>{t('exam')}</span>}
          {session.extra && session.type !== 'exam' && <span>{t('extra')}</span>}
          {session.status !== 'scheduled' && (
            <span className="font-semibold text-(--ssz-text-primary)">
              {t(`status.${session.status}` as 'status.held')}
            </span>
          )}
        </span>
      </div>

      <div className="mt-1 flex items-start gap-1">
        <Link
          href={`${wsHref(workspaceId, `groups/${session.groupId}`)}?tab=schedule`}
          className="min-w-0 flex-1 rounded hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {/* Seven columns leave a card too narrow for most names, so the full one stays
              reachable without opening anything. */}
          <p
            title={session.title}
            className={`truncate text-sm font-medium text-(--ssz-text-primary) ${cancelled ? 'line-through' : ''}`}
          >
            {session.title}
          </p>
          <p
            title={session.topicTitle ?? undefined}
            className="truncate text-xs text-(--ssz-text-muted)"
          >
            {session.topicTitle ?? t('noTopic')}
          </p>
        </Link>

        <SessionActions
          workspaceId={workspaceId}
          groupId={session.groupId}
          sessionId={session.id}
          title={session.title}
          date={session.date}
          start={session.start}
          end={session.end}
          status={session.status}
        />
      </div>
    </div>
  );
}

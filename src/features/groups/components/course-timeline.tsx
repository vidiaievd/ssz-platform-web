'use client';

import { Plus } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { timelineWeeks, topicOf, type SessionState } from '../lib/session-derive';
import { dayMonth } from '../lib/session-format';
import type { OutlineUnit, Session } from '../types';

/** How a cell reads at a glance. An exam keeps its own outline in every state. */
const CELL_TONE: Record<SessionState, string> = {
  held: 'bg-success-500',
  sub: 'bg-warning-500',
  cancelled: 'bg-error-100 border-[1.5px] border-error-500 dark:bg-error-900/30',
  next: 'bg-primary-100 border-[1.5px] border-primary-500 dark:bg-primary-900/30',
  planned: 'bg-muted',
};

type Props = {
  sessions: Session[];
  units: OutlineUnit[];
  staff: { primaryId: string | null; coPrimaryId: string | null };
  perWeek: number;
  canManage: boolean;
  onEditSession: (sessionId: string) => void;
  onAddSession: () => void;
};

/**
 * The whole course as one strip: a column per week, a cell per session. It
 * answers the question a list of dates cannot — how far along the group is, and
 * where the cancellations and cover cluster.
 */
export function CourseTimeline({
  sessions,
  units,
  staff,
  perWeek,
  canManage,
  onEditSession,
  onAddSession,
}: Props) {
  const t = useTranslations('Groups');
  const locale = useLocale();
  const weeks = timelineWeeks(sessions, staff);

  return (
    <section
      aria-labelledby="schedule-timeline-heading"
      className="rounded-lg border border-border bg-card p-5"
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3
            id="schedule-timeline-heading"
            className="text-sm font-semibold text-(--ssz-text-primary)"
          >
            {t('schedule.timelineHeading')}
          </h3>
          <p className="mt-0.5 text-xs text-(--ssz-text-muted)">
            {t('schedule.timelineCaption', { weeks: weeks.length, perWeek })}
          </p>
        </div>
        {canManage && (
          <Button variant="outline" size="sm" onClick={onAddSession}>
            <Plus className="size-3.5 mr-1.5" aria-hidden="true" />
            {t('schedule.addSession')}
          </Button>
        )}
      </div>

      {weeks.length === 0 ? (
        <p className="py-2 text-sm italic text-(--ssz-text-muted)">{t('schedule.noSessions')}</p>
      ) : (
        <div className="overflow-x-auto pb-1">
          <div className="flex gap-1">
            {weeks.map((week) => (
              <div key={week.week} className="flex min-w-4 flex-1 flex-col gap-[3px]">
                {week.cells.map(({ session, state }) => {
                  const topic = topicOf(session, units);
                  const label = [
                    dayMonth(session.date, locale),
                    topic?.itemTitle ?? topic?.unitTitle ?? t('schedule.noTopic'),
                    session.type === 'exam' ? t('schedule.exam') : null,
                    t(`schedule.state.${state}`),
                  ]
                    .filter(Boolean)
                    .join(' · ');

                  return (
                    <button
                      key={session.id}
                      type="button"
                      title={label}
                      aria-label={label}
                      onClick={() => onEditSession(session.id)}
                      className={cn(
                        'h-[15px] w-full rounded transition-opacity hover:opacity-75',
                        CELL_TONE[state],
                        // Shape, not colour, is what tells an exam apart — it has
                        // to survive every status a session can be in.
                        session.type === 'exam' && 'rounded-lg border-[1.5px] border-error-500',
                      )}
                    />
                  );
                })}
                {/* Every other week is numbered; all of them would speckle. */}
                <span className="mt-0.5 h-3 text-center text-[8.5px] tabular-nums text-(--ssz-text-muted)">
                  {week.week % 2 === 1 ? week.week : ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] text-(--ssz-text-muted)">
        {(['held', 'sub', 'cancelled', 'planned'] as const).map((state) => (
          <li key={state} className="flex items-center gap-1.5">
            <span className={cn('inline-block size-2.5 rounded-[3px]', CELL_TONE[state])} />
            {t(`schedule.state.${state}`)}
          </li>
        ))}
        <li className="flex items-center gap-1.5">
          <span className="inline-block size-2.5 rounded-full border-[1.5px] border-error-500" />
          {t('schedule.exam')}
        </li>
      </ul>
    </section>
  );
}

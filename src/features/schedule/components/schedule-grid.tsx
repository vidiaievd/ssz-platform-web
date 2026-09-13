import { getTranslations, getFormatter } from 'next-intl/server';

import { SessionCard } from './session-card';
import { byDay, type DateRange, type RangeKind } from '../lib/range';
import type { ScheduleSession } from '../api/get-my-schedule';

type Props = {
  kind: RangeKind;
  range: DateRange;
  sessions: ScheduleSession[];
  workspaceId: string;
  /** Today, so the current day can be marked without the component asking the clock. */
  today: string;
};

/**
 * The teaching week, or the month it sits in.
 *
 * One component for both, because they are one question at two scales and a second
 * component would be a second answer to it. A week gets seven columns that each hold a
 * card; a month gets the same days at a glance, with the same cards inside them.
 *
 * Days with nothing on them stay on the screen. A week drawn only from the days that have
 * lessons reads as a full week to someone scanning it.
 */
export async function ScheduleGrid({ kind, range, sessions, workspaceId, today }: Props) {
  const [t, format] = await Promise.all([getTranslations('Scheduling.my'), getFormatter()]);
  const days = byDay(range, sessions);

  // A month is a calendar, so its first day has to sit under its own weekday; a grid that
  // simply flows would put the 1st under Monday whatever day it fell on. A week needs no
  // padding — it starts on Monday by construction.
  const lead =
    kind === 'month' && days[0]
      ? (new Date(`${days[0].day}T00:00:00.000Z`).getUTCDay() + 6) % 7
      : 0;

  return (
    <div
      className="grid gap-2 grid-cols-1 sm:grid-cols-2 lg:grid-cols-7"
      role="list"
      aria-label={t('title')}
    >
      {Array.from({ length: lead }, (_, i) => (
        <div key={`lead-${i}`} aria-hidden className="hidden lg:block" />
      ))}
      {days.map(({ day, items }) => {
        const date = new Date(`${day}T00:00:00.000Z`);
        const isToday = day === today;

        return (
          <section
            key={day}
            role="listitem"
            aria-label={t('dayLabel', {
              weekday: format.dateTime(date, { weekday: 'long', timeZone: 'UTC' }),
              date: format.dateTime(date, { day: 'numeric', month: 'long', timeZone: 'UTC' }),
            })}
            className={`min-h-24 rounded-lg border p-2 ${
              isToday ? 'border-primary bg-primary/5' : 'border-border bg-muted/20'
            }`}
          >
            <p className="mb-2 flex items-baseline gap-1.5 text-xs font-semibold uppercase tracking-wide text-(--ssz-text-muted)">
              <span>{format.dateTime(date, { weekday: 'short', timeZone: 'UTC' })}</span>
              <span className="tabular-nums text-(--ssz-text-primary)">
                {format.dateTime(date, { day: 'numeric', timeZone: 'UTC' })}
              </span>
            </p>

            <div className="space-y-1.5">
              {items.map((session) => (
                <SessionCard key={session.id} session={session} workspaceId={workspaceId} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

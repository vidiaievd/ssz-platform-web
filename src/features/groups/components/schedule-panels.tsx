'use client';

import { useLocale, useTranslations } from 'next-intl';

import { Avatar } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import {
  byDate,
  coverageByUnit,
  examStats,
  gradeTone,
  whoTaught,
  type GradeTone,
  type TeachingStaff,
} from '../lib/session-derive';
import { dayMonth } from '../lib/session-format';
import type { GroupTeacher, OutlineUnit, Session } from '../types';

const BAR_TONE: Record<GradeTone, string> = {
  success: 'bg-success-500',
  primary: 'bg-primary-500',
  warn: 'bg-warning-500',
  danger: 'bg-error-500',
};

function Panel({
  title,
  caption,
  children,
}: {
  title: string;
  caption: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <h3 className="text-sm font-semibold text-(--ssz-text-primary)">{title}</h3>
      <p className="mt-0.5 text-xs text-(--ssz-text-muted)">{caption}</p>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Bar({ pct, tone }: { pct: number; tone: string }) {
  return (
    <span className="block h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <span className={cn('block h-full rounded-full', tone)} style={{ width: `${pct}%` }} />
    </span>
  );
}

/**
 * How the group is doing on the checkpoints — the panel that comes first,
 * because a manager cares more about whether the group is learning than about
 * who taught it.
 */
export function AssessmentPanel({
  sessions,
  units,
  passMark,
  onEditSession,
}: {
  sessions: Session[];
  units: OutlineUnit[];
  passMark: number;
  onEditSession: (sessionId: string) => void;
}) {
  const t = useTranslations('Groups');
  const locale = useLocale();

  const exams = sessions.filter((s) => s.type === 'exam' && s.status !== 'cancelled').sort(byDate);
  const rows = exams.map((session) => {
    const unit = units.find((u) => u.id === session.contentUnitId) ?? null;
    return {
      session,
      title: unit
        ? t('schedule.checkpointOf', { n: unit.order })
        : t('schedule.checkpoint'),
      marks: examStats(session.scores, session.passMark ?? passMark),
    };
  });
  const graded = rows.filter((r) => r.marks.average !== null).length;

  return (
    <Panel
      title={t('schedule.assessmentHeading')}
      caption={t('schedule.assessmentCaption', { graded, total: rows.length })}
    >
      {rows.length === 0 ? (
        <p className="text-xs text-(--ssz-text-muted)">{t('schedule.noExams')}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map(({ session, title, marks }) => (
            <li key={session.id}>
              <button
                type="button"
                onClick={() => onEditSession(session.id)}
                className="w-full text-left"
              >
                <span className="flex items-baseline gap-2">
                  <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-(--ssz-text-primary)">
                    {title}
                  </span>
                  <span className="shrink-0 text-[13px] font-semibold tabular-nums text-(--ssz-text-primary)">
                    {marks.average === null ? '—' : `${marks.average}%`}
                  </span>
                </span>
                <span className="mt-0.5 block text-[11px] text-(--ssz-text-muted)">
                  {marks.average === null
                    ? t('schedule.examNotGraded', { date: dayMonth(session.date, locale) })
                    : t('schedule.examPassed', {
                        date: dayMonth(session.date, locale),
                        passed: marks.passed,
                        graded: marks.graded,
                      })}
                </span>
                <span className="mt-1.5 block">
                  <Bar
                    pct={marks.average ?? 0}
                    tone={marks.average === null ? 'bg-muted' : BAR_TONE[gradeTone(marks.average)]}
                  />
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

/**
 * Who actually stood in front of the group. Cover and co-teaching are drawn in
 * warn rather than in the group's own colour: a group being carried by
 * substitutes has to read as such at a glance.
 */
export function WhoTaughtPanel({
  sessions,
  teachers,
  staff,
}: {
  sessions: Session[];
  teachers: GroupTeacher[];
  staff: TeachingStaff;
}) {
  const t = useTranslations('Groups');
  const shares = whoTaught(sessions, staff);
  const delivered = shares.reduce((sum, s) => sum + s.delivered, 0);

  return (
    <Panel
      title={t('schedule.whoTaughtHeading')}
      caption={t('schedule.whoTaughtCaption', { n: delivered })}
    >
      {shares.length === 0 ? (
        <p className="text-xs text-(--ssz-text-muted)">{t('schedule.noneDelivered')}</p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {shares.map((share) => {
            const teacher = teachers.find((x) => x.userId === share.teacherId) ?? null;
            return (
              <li key={share.teacherId} className="flex items-center gap-2.5">
                <Avatar
                  name={teacher?.name ?? '?'}
                  src={teacher?.avatarUrl ?? undefined}
                  size="sm"
                />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-xs text-(--ssz-text-primary)">
                      {teacher?.name ?? t('schedule.unknownTeacher')}
                    </span>
                    <span className="shrink-0 text-[11px] tabular-nums text-(--ssz-text-muted)">
                      {share.pct}%
                    </span>
                  </span>
                  <span className="mt-1 block">
                    <Bar
                      pct={share.pct}
                      tone={share.isPrimary ? 'bg-primary-500' : 'bg-warning-500'}
                    />
                  </span>
                </span>
                <span className="w-4 shrink-0 text-right text-xs font-semibold tabular-nums text-(--ssz-text-primary)">
                  {share.delivered}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

/**
 * How much of each unit the group has been through. Counted from what was held,
 * not from a stored counter — a cancelled session leaves its topic untaught.
 */
export function CoveragePanel({
  sessions,
  units,
}: {
  sessions: Session[];
  units: OutlineUnit[];
}) {
  const t = useTranslations('Groups');
  const coverage = new Map(coverageByUnit(sessions).map((c) => [c.contentUnitId, c]));
  // Units of the course, in course order — including the ones nothing has been
  // planned against, which are exactly the ones worth seeing as untouched.
  const rows = units.map((unit) => ({
    unit,
    stats: coverage.get(unit.id) ?? { taught: 0, planned: 0, state: 'untouched' as const },
  }));

  return (
    <Panel title={t('schedule.coverageHeading')} caption={t('schedule.coverageCaption')}>
      {rows.length === 0 ? (
        <p className="text-xs text-(--ssz-text-muted)">{t('schedule.noCourseUnits')}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map(({ unit, stats }) => (
            <li key={unit.id} className="flex items-center gap-2">
              <span
                className={cn(
                  'size-2 shrink-0 rounded-full',
                  stats.state === 'done'
                    ? 'bg-success-500'
                    : stats.state === 'in-progress'
                      ? 'bg-primary-500'
                      : 'bg-neutral-300',
                )}
                aria-hidden="true"
              />
              <span className="min-w-0 flex-1 truncate text-xs text-(--ssz-text-primary)">
                {t('schedule.unitLabelled', { n: unit.order, title: unit.title })}
              </span>
              <span className="shrink-0 text-xs tabular-nums text-(--ssz-text-muted)">
                {stats.taught}/{stats.planned}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

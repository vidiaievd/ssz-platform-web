'use client';

import { Calendar, Pencil } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';

import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { weekdayDayMonth } from '../lib/session-format';
import { topicOf } from '../lib/session-derive';
import type { GroupTeacher, OutlineUnit, Session } from '../types';

type Props = {
  session: Session;
  units: OutlineUnit[];
  teachers: GroupTeacher[];
  canManage: boolean;
  onEdit: (sessionId: string) => void;
};

/**
 * The one session everything else is waiting on. Accented rather than merely
 * listed: on a page that is otherwise a record of the past, the next lesson is
 * the only row anybody can still act on.
 */
export function NextSessionCard({ session, units, teachers, canManage, onEdit }: Props) {
  const t = useTranslations('Groups');
  const locale = useLocale();
  const topic = topicOf(session, units);
  const teacher = teachers.find((x) => x.userId === session.teacherId) ?? null;

  const heading = t('schedule.nextSessionHeading', {
    date: weekdayDayMonth(session.date, locale),
    start: session.start,
    end: session.end,
  });

  const detail = [
    topic ? t('schedule.unitLabelled', { n: topic.unitOrder, title: topic.unitTitle }) : null,
    session.room || null,
  ].filter(Boolean);

  return (
    <section className="flex items-start gap-3.5 rounded-lg border border-primary-500 bg-primary-50 p-4 dark:bg-primary-900/20">
      <div className="flex size-[46px] shrink-0 items-center justify-center rounded-xl bg-card">
        <Calendar className="size-5 text-primary-600" aria-hidden="true" />
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-bold uppercase tracking-wide text-primary-700 dark:text-primary-300">
          {heading}
          {session.type === 'exam' && ` · ${t('schedule.exam')}`}
        </p>
        <p className="mt-1 truncate text-[15.5px] font-semibold text-(--ssz-text-primary)">
          {topic?.itemTitle ?? topic?.unitTitle ?? t('schedule.noTopic')}
        </p>
        {detail.length > 0 && (
          <p className="mt-0.5 truncate text-xs text-(--ssz-text-muted)">{detail.join(' · ')}</p>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {teacher ? (
          <span className="flex items-center gap-1.5 text-xs text-(--ssz-text-secondary)">
            <Avatar name={teacher.name} src={teacher.avatarUrl ?? undefined} size="sm" />
            <span className="hidden sm:inline">{teacher.name}</span>
          </span>
        ) : (
          <Badge variant="error">{t('schedule.noTeacher')}</Badge>
        )}
        {canManage && (
          <Button variant="ghost" size="sm" onClick={() => onEdit(session.id)}>
            <Pencil className="size-3.5 mr-1.5" aria-hidden="true" />
            {t('schedule.edit')}
          </Button>
        )}
      </div>
    </section>
  );
}

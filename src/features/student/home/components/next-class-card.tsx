'use client';

import { CalendarDays, MapPin } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';

import { Avatar } from '@/components/ui/avatar';
import type { NextClass } from '@/features/student/types';
import { useRouter } from '@/lib/i18n/navigation';
import { ReminderCard } from './reminder-card';

export interface NextClassCardProps {
  nextClass: NextClass | null;
}

/** Local wall-clock instant of the lesson start, used only for the relative "in …" line. */
function startsAt(nextClass: NextClass): Date {
  return new Date(`${nextClass.date}T${nextClass.startTime}:00`);
}

/**
 * "Next class" reminder. Renders a calm placeholder rather than disappearing
 * when the student has no scheduled class — the slot is part of the layout,
 * and an empty one is information too.
 */
export function NextClassCard({ nextClass }: NextClassCardProps) {
  const t = useTranslations('Student.home.nextClass');
  const format = useFormatter();
  const router = useRouter();

  if (!nextClass) {
    return (
      <ReminderCard tone="info" icon={CalendarDays} overline={t('overline')}>
        <p className="text-[13px] leading-relaxed text-(--ssz-text-secondary)">{t('empty')}</p>
      </ReminderCard>
    );
  }

  const start = startsAt(nextClass);
  const isValidDate = !Number.isNaN(start.getTime());

  return (
    <ReminderCard
      tone="info"
      icon={CalendarDays}
      overline={t('overline')}
      cta={t('cta')}
      onCta={() => router.push(`/student/schools/${nextClass.schoolSlug}`)}
    >
      <p className="text-[17px] font-bold tracking-[-0.01em] text-(--ssz-text-primary)">
        {isValidDate ? format.dateTime(start, { weekday: 'long', day: 'numeric', month: 'short' }) : nextClass.date}
        {' · '}
        {nextClass.startTime}–{nextClass.endTime}
      </p>
      {isValidDate && (
        <p className="mt-0.5 text-[12.5px] font-semibold text-(--ssz-color-info-700)">
          {format.relativeTime(start)}
        </p>
      )}

      <p className="mt-2 text-[13px] leading-relaxed text-(--ssz-text-secondary)">
        {nextClass.groupName ? `${nextClass.groupName} · ${nextClass.schoolName}` : nextClass.schoolName}
      </p>

      {nextClass.room && (
        <p className="mt-1.5 flex items-center gap-1.5 text-[12.5px] text-(--ssz-text-secondary)">
          <MapPin size={13} className="text-(--ssz-text-muted)" aria-hidden="true" />
          {nextClass.room}
        </p>
      )}

      {nextClass.teacher && (
        <div className="mt-2.5 flex items-center gap-2">
          <Avatar
            size="sm"
            name={nextClass.teacher.name}
            src={nextClass.teacher.avatarUrl ?? undefined}
            color="oklch(0.60 0.12 235)"
          />
          <span className="text-[12.5px] text-(--ssz-text-secondary)">{nextClass.teacher.name}</span>
        </div>
      )}
    </ReminderCard>
  );
}

'use client';

import { useLocale, useTranslations } from 'next-intl';
import { CalendarDays, Users } from 'lucide-react';

import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/avatar';
import { Link } from '@/lib/i18n/navigation';
import type { StudentSchool } from '../types';

interface SchoolSummaryCardProps {
  school: StudentSchool;
}

function formatNextLessonDay(dateIso: string, startTime: string, locale: string): string {
  const date = new Date(`${dateIso}T${startTime}:00`);
  return new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', month: 'short' }).format(date);
}

/**
 * Active-membership row for the "My schools" band — the richer counterpart
 * to SchoolStatusCard (which only covers non-active/terminal states). Links
 * into the school detail page where the full schedule and materials live.
 */
export function SchoolSummaryCard({ school }: SchoolSummaryCardProps) {
  const t = useTranslations('Student.MySchools');
  const locale = useLocale();
  const next = school.nextLesson;
  const nextLessonLabel = next
    ? t('nextLessonAt', { day: formatNextLessonDay(next.date, next.start, locale), start: next.start, end: next.end })
    : null;

  return (
    <Link href={`/student/schools/${school.schoolSlug}`} className="block">
      <Card hover>
        <CardHeader className="flex-row items-start justify-between gap-3 pb-3">
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground">{school.schoolName}</p>
            <CardTitle className="text-base">{school.groupName ?? school.schoolName}</CardTitle>
          </div>
          {school.level && <Badge variant="primary">{school.level}</Badge>}
        </CardHeader>

        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <CalendarDays className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{nextLessonLabel ?? t('noUpcomingLesson')}</span>
          </div>

          {school.teachers.length > 0 && (
            <div className="flex items-center gap-2">
              <div className="flex -space-x-2">
                {school.teachers.slice(0, 3).map((teacher) => (
                  <Avatar
                    key={teacher.userId}
                    name={teacher.name}
                    src={teacher.avatarUrl ?? undefined}
                    size="sm"
                    // Avatar's default initials color (oklch(0.62 0.105 168)) fails AA contrast
                    // at this size — override with primary-700, the same dark accent Badge uses
                    // for readable text. Must be a literal color, not var(): Avatar appends an
                    // alpha suffix directly to this string for the background tint.
                    color="oklch(0.44 0.09 168)"
                  />
                ))}
              </div>
              <span className="text-muted-foreground truncate">
                {school.teachers.map((teacher) => teacher.name).join(', ')}
              </span>
            </div>
          )}

          {school.classmateCount != null && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Users className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{t('classmateCount', { count: school.classmateCount })}</span>
            </div>
          )}
        </div>
      </Card>
    </Link>
  );
}

'use client';

import { useTranslations } from 'next-intl';
import { ArrowLeft, MapPin, Wifi } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/avatar';
import { RouteHeading } from '@/components/shared/route-heading';
import { Link } from '@/lib/i18n/navigation';
import type { StudentSchool, SchoolTeacherSummary } from '../types';
// LeaveSchoolButton hidden: organization-service has no leave command yet (plan 19 §F2)

interface GroupHeaderProps {
  school: StudentSchool;
}

function teacherRoleKey(role: SchoolTeacherSummary['role']): 'teacherRolePrimary' | 'teacherRoleCoPrimary' | 'teacherRoleSubstitute' {
  if (role === 'co-primary') return 'teacherRoleCoPrimary';
  if (role === 'substitute') return 'teacherRoleSubstitute';
  return 'teacherRolePrimary';
}

/** Header for the school detail page — group identity, level/mode, and the teaching team. */
export function GroupHeader({ school }: GroupHeaderProps) {
  const t = useTranslations('Student.SchoolDetail');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <Link
          href="/student/dashboard#my-schools-heading"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          {t('backLink')}
        </Link>
        {/* plan-19 §F2: leave button hidden until org-service supports active→left command */}
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{school.schoolName}</p>
          <RouteHeading className="text-2xl font-semibold">{school.groupName ?? school.schoolName}</RouteHeading>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {school.level && <Badge variant="level">{school.level}</Badge>}
          {school.mode && (
            <Badge variant="muted">
              {school.mode === 'online' ? (
                <Wifi className="h-3 w-3" aria-hidden="true" />
              ) : (
                <MapPin className="h-3 w-3" aria-hidden="true" />
              )}
              {school.mode === 'online' ? t('modeOnline') : t('modeInPerson')}
            </Badge>
          )}
        </div>
      </div>

      {school.teachers.length > 0 && (
        <ul className="flex flex-wrap gap-4" aria-label={t('teachersLabel')}>
          {school.teachers.map((teacher) => (
            <li key={teacher.userId} className="flex items-center gap-2">
              <Avatar name={teacher.name} src={teacher.avatarUrl ?? undefined} size="sm" color="oklch(0.44 0.09 168)" />
              <div className="text-sm">
                <p className="font-medium leading-tight">{teacher.name}</p>
                <p className="text-xs text-muted-foreground leading-tight">{t(teacherRoleKey(teacher.role))}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

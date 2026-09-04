'use client';

import { useState, useCallback } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { TrendingUp, AlertTriangle } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Avatar } from '@/components/ui/avatar';
import type { TimetableTeacher } from '../types';

type Props = {
  teachers: TimetableTeacher[];
  initialTeacherId: string | null;
};

function pct(hours: number, max: number) {
  return max > 0 ? Math.min((hours / max) * 100, 100) : 0;
}

function barColor(p: number, overloaded: boolean) {
  if (overloaded || p > 100) return 'bg-error-500';
  if (p >= 85) return 'bg-warning-500';
  return 'bg-primary';
}

export function TeacherSelector({ teachers, initialTeacherId }: Props) {
  const t = useTranslations('Groups');
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [activeId, setActiveId] = useState<string | null>(
    initialTeacherId ?? teachers[0]?.userId ?? null,
  );

  const selectTeacher = useCallback(
    (userId: string) => {
      setActiveId(userId);
      const params = new URLSearchParams(searchParams.toString());
      params.set('teacher', userId);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [router, pathname, searchParams],
  );

  if (teachers.length === 0) {
    return (
      <p className="text-sm text-(--ssz-text-muted) px-3 py-4">{t('timetable.noTeachers')}</p>
    );
  }

  const sorted = [...teachers].sort((a, b) => b.pct - a.pct);

  return (
    <ul className="flex flex-col gap-0.5" role="listbox" aria-label={t('timetable.teacherListLabel')}>
      {sorted.map((t) => {
        const isActive = t.userId === activeId;
        const fill = pct(t.hours, t.max);
        const color = barColor(fill, t.overloaded);

        return (
          <li key={t.userId} role="option" aria-selected={isActive}>
            <button
              type="button"
              onClick={() => selectTeacher(t.userId)}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors',
                isActive
                  ? 'bg-primary-50 dark:bg-primary-900/20 ring-1 ring-primary/30'
                  : 'hover:bg-muted/60',
              )}
              aria-label={`${t.name}: ${t.hours.toFixed(1)} of ${t.max} hours${t.overloaded ? ', overloaded' : ''}${t.conflicts > 0 ? `, ${t.conflicts} schedule conflict${t.conflicts > 1 ? 's' : ''}` : ''}`}
            >
              <Avatar name={t.name} src={t.avatarUrl ?? undefined} size="sm" />

              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-(--ssz-text-primary) truncate">{t.name}</p>
                <div className="flex items-center gap-2 mt-1">
                  <div
                    role="progressbar"
                    aria-hidden="true"
                    className="flex-1 h-1 rounded-full bg-border overflow-hidden"
                  >
                    <div
                      className={cn('h-full rounded-full transition-[width]', color)}
                      style={{ width: `${fill}%` }}
                    />
                  </div>
                  <span className="text-[11px] text-(--ssz-text-muted) font-mono whitespace-nowrap shrink-0">
                    {t.hours.toFixed(1)}/{t.max}h
                  </span>
                </div>
                <p className="text-xs text-(--ssz-text-muted) mt-0.5">
                  {t.groups} {t.groups === 1 ? 'group' : 'groups'}
                </p>
              </div>

              <div className="flex flex-col items-end gap-1 shrink-0">
                {t.overloaded && (
                  <TrendingUp className="size-3.5 text-error-500" aria-hidden="true" />
                )}
                {t.conflicts > 0 && (
                  <AlertTriangle className="size-3.5 text-warning-500" aria-hidden="true" />
                )}
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

'use client';

import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';

import { Avatar } from '@/components/ui/avatar';

import { AgeSpread } from '../age-spread';
import { useAgeWords } from '../age-mark';
import { ageTone } from '../../lib/age-scale';
import type { OversightTeacher } from '../../types/oversight';

export interface TeacherLoadRowProps {
  teacher: OversightTeacher;
  /** The school's promise — the scale this row's histogram is drawn against. */
  slaHours: number | null;
  /** What can be done about this row. Revealed on hover; always reachable by keyboard. */
  actions?: ReactNode;
}

/**
 * One teacher's load, as a shape rather than a number (criterion 28).
 *
 * "34 waiting" is where most such screens stop, and it is exactly the point where the two
 * cases that matter become indistinguishable: thirty-four handed in this week, and
 * thirty-four of which eight have been sitting for a fortnight. The first is a busy
 * teacher, the second is something that has stopped moving. The histogram is what tells
 * them apart, so it sits in the row itself and not behind a click.
 *
 * Where two people review one group, both rows carry its queue in full — that is what each
 * of them has to read — and the caption says so, because otherwise the rows add up to more
 * than the school's total with no explanation on screen (plan 46 §46.1).
 *
 * The actions fade in on hover at .55 → 1 rather than appearing, so the row does not change
 * height or width under the pointer; at full opacity they are also always in the tab order,
 * because a control that only exists under a mouse does not exist for a keyboard.
 */
export function TeacherLoadRow({ teacher, slaHours, actions }: TeacherLoadRowProps) {
  const t = useTranslations('Review.oversight.teachers');
  const { words } = useAgeWords();

  return (
    <div className="group grid grid-cols-[minmax(180px,1.4fr)_88px_88px_minmax(140px,1fr)_auto] items-center gap-4 rounded-[11px] px-3 py-[13px] transition-colors hover:bg-(--ssz-bg-subtle)">
      <div className="flex min-w-0 items-center gap-2.5">
        <Avatar name={teacher.name ?? '—'} size="sm" />
        <div className="min-w-0">
          <div className="truncate text-[13.5px] font-semibold">{teacher.name ?? t('unnamed')}</div>
          <div className="truncate text-[11.5px] text-muted-foreground">
            {teacher.groups.length === 0 ? t('noGroups') : teacher.groups.join(' · ')}
          </div>
        </div>
      </div>

      <div>
        <div className="text-lg font-bold tracking-[-0.02em]">{teacher.pending}</div>
        <div className="text-[11px] text-muted-foreground">{t('pending')}</div>
      </div>

      <div>
        <div
          className="text-lg font-bold tracking-[-0.02em]"
          style={
            teacher.overdue === 0 || slaHours === null
              ? { color: 'var(--ssz-text-muted)' }
              : { color: ageTone(slaHours * 1.6, slaHours) }
          }
        >
          {teacher.overdue === 0 ? '—' : teacher.overdue}
        </div>
        <div className="text-[11px] text-muted-foreground">{t('overdue')}</div>
      </div>

      <div className="min-w-0">
        {slaHours === null ? null : (
          <AgeSpread hours={teacher.ages} slaHours={slaHours} height={9} className="w-full" />
        )}
        <div className="mt-[5px] text-[11px] text-muted-foreground">
          {teacher.medianHours === null
            ? t('noMedian')
            : t('median', { age: words(teacher.medianHours) })}
          {teacher.shared ? ` · ${t('shared')}` : ''}
        </div>
      </div>

      <div className="flex gap-[7px] opacity-55 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
        {actions}
      </div>
    </div>
  );
}

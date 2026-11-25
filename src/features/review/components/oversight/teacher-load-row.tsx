'use client';

import type { ReactNode } from 'react';
import { useFormatter, useTranslations } from 'next-intl';

import { Avatar } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

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
  /**
   * Draw the column of work closed at the term (plan 80, R4). Set for every row or none, so
   * the columns line up; the screen sets it when the school's journal has anything in it.
   */
  showTerms?: boolean;
  /**
   * Draw the column of time held for marking (plan 81), averaged over this many weeks ahead;
   * null when the timetable could not be read, so the column says so instead of showing
   * zeros. Left out, the column is not drawn.
   */
  heldWeeks?: number | null;
}

/**
 * The row's columns for each set of optional columns. The last track holds the actions
 * (≈ 230 px for "Assign a helper" in Ukrainian); where the row is narrower than the
 * columns' minimum widths plus that track, the actions move to a line of their own under
 * the figures, side by side on the right — otherwise they ran past the panel's edge on a
 * 1280 px screen with the sidebar open (П7-1). Thresholds = minimums + gaps + padding +
 * the actions, with room for longer labels in other languages. Narrower still (a 1024 px
 * screen), the figures alone do not fit: the histogram takes a line of its own as well and
 * the name column gives up 40 px. Class names are spelled out in full so Tailwind sees them.
 */
const LAYOUTS = {
  termsHeld: {
    grid:
      'grid-cols-[minmax(180px,1.4fr)_88px_88px_120px_108px_minmax(140px,1fr)_auto] ' +
      '@max-[68rem]:grid-cols-[minmax(180px,1.4fr)_88px_88px_120px_108px_minmax(140px,1fr)] ' +
      '@max-[52rem]:grid-cols-[minmax(140px,1fr)_88px_88px_120px_108px]',
    actions: '@max-[68rem]:col-span-full @max-[68rem]:flex-row @max-[68rem]:justify-end',
    spread: '@max-[52rem]:col-span-full',
  },
  terms: {
    grid:
      'grid-cols-[minmax(180px,1.4fr)_88px_88px_120px_minmax(140px,1fr)_auto] ' +
      '@max-[61rem]:grid-cols-[minmax(180px,1.4fr)_88px_88px_120px_minmax(140px,1fr)] ' +
      '@max-[45rem]:grid-cols-[minmax(140px,1fr)_88px_88px_120px]',
    actions: '@max-[61rem]:col-span-full @max-[61rem]:flex-row @max-[61rem]:justify-end',
    spread: '@max-[45rem]:col-span-full',
  },
  held: {
    grid:
      'grid-cols-[minmax(180px,1.4fr)_88px_88px_108px_minmax(140px,1fr)_auto] ' +
      '@max-[60rem]:grid-cols-[minmax(180px,1.4fr)_88px_88px_108px_minmax(140px,1fr)] ' +
      '@max-[44rem]:grid-cols-[minmax(140px,1fr)_88px_88px_108px]',
    actions: '@max-[60rem]:col-span-full @max-[60rem]:flex-row @max-[60rem]:justify-end',
    spread: '@max-[44rem]:col-span-full',
  },
  plain: {
    grid:
      'grid-cols-[minmax(180px,1.4fr)_88px_88px_minmax(140px,1fr)_auto] ' +
      '@max-[53rem]:grid-cols-[minmax(180px,1.4fr)_88px_88px_minmax(140px,1fr)] ' +
      '@max-[36rem]:grid-cols-[minmax(140px,1fr)_88px_88px]',
    actions: '@max-[53rem]:col-span-full @max-[53rem]:flex-row @max-[53rem]:justify-end',
    spread: '@max-[36rem]:col-span-full',
  },
} as const;

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
 * Under a model-first policy a queue can also shrink without anyone reading it: the term
 * closes work by itself (plan 80). That column is the other half of the load — what was not
 * carried — and a short queue beside a long count there is the teacher who needs a helper.
 * Next to it, the time the teacher holds for marking (plan 81): a long queue with no time
 * set aside is a timetable to fix before it is a person to chase.
 *
 * The actions fade in on hover at .55 → 1 rather than appearing, so the row does not change
 * height or width under the pointer; at full opacity they are also always in the tab order,
 * because a control that only exists under a mouse does not exist for a keyboard.
 */
export function TeacherLoadRow({
  teacher,
  slaHours,
  actions,
  showTerms = false,
  heldWeeks,
}: TeacherLoadRowProps) {
  const t = useTranslations('Review.oversight.teachers');
  const format = useFormatter();
  const { words } = useAgeWords();

  const showHeld = heldWeeks !== undefined;
  const held = heldWeeks === null ? null : teacher.heldHoursPerWeek;

  const layout =
    showTerms && showHeld
      ? LAYOUTS.termsHeld
      : showTerms
        ? LAYOUTS.terms
        : showHeld
          ? LAYOUTS.held
          : LAYOUTS.plain;

  return (
    <div className="@container">
      <div
        className={cn(
          'group grid items-center gap-4 rounded-[11px] px-3 py-[13px] transition-colors hover:bg-(--ssz-bg-subtle)',
          layout.grid,
        )}
      >
        <div className="flex min-w-0 items-center gap-2.5">
          <Avatar name={teacher.name ?? '—'} size="sm" />
          <div className="min-w-0">
            <div className="truncate text-[13.5px] font-semibold">
              {teacher.name ?? t('unnamed')}
            </div>
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

        {showTerms ? (
          <div>
            <div
              className="text-lg font-bold tracking-[-0.02em]"
              style={teacher.terms === null ? { color: 'var(--ssz-text-muted)' } : undefined}
            >
              {teacher.terms === null ? '—' : teacher.terms.accepted}
            </div>
            <div className="text-[11px] text-muted-foreground">
              {teacher.terms === null || teacher.terms.revised === 0
                ? t('terms')
                : t('termsRevised', {
                    revised: teacher.terms.revised,
                    overturned: teacher.terms.overturned,
                  })}
            </div>
          </div>
        ) : null}

        {showHeld ? (
          <div title={heldWeeks === null ? undefined : t('heldHint', { weeks: heldWeeks })}>
            <div
              className="text-lg font-bold tracking-[-0.02em]"
              style={held === null || held === 0 ? { color: 'var(--ssz-text-muted)' } : undefined}
            >
              {held === null || held === 0
                ? '—'
                : t('heldHours', { hours: format.number(held, { maximumFractionDigits: 1 }) })}
            </div>
            <div className="text-[11px] text-muted-foreground">
              {held === null ? t('heldUnread') : held === 0 ? t('heldNone') : t('held')}
            </div>
          </div>
        ) : null}

        <div className={cn('min-w-0', layout.spread)}>
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

        {/* Stacked: two labelled buttons side by side do not fit beside six columns. */}
        <div
          className={cn(
            'flex flex-col items-stretch gap-[5px] opacity-55 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100',
            layout.actions,
          )}
        >
          {actions}
        </div>
      </div>
    </div>
  );
}

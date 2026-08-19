'use client';

import { Lock } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Avatar } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

import { ageRail, ageTextTone, ageTone } from '../../lib/age-scale';
import type { ReviewGroupBy, ReviewQueueItem } from '../../types';
import { useAgeWords } from '../age-mark';

export interface QueueRowProps {
  item: ReviewQueueItem;
  /** The promise this row's age is coloured against — the group's, not the school's. */
  slaHours: number | null;
  /** Which pass this is: it decides which of the two names leads the row. */
  groupBy: ReviewGroupBy;
  selected: boolean;
  onSelect: (id: string) => void;
}

/**
 * One waiting submission.
 *
 * Read left to right it is: how urgent, who, what, how long. The rail carries urgency as
 * both colour and width and the age is repeated in words on the right, because a teacher
 * coming back from a week off sees a list where every rail is red — at that point the
 * colour has stopped distinguishing anything and the words are the whole signal
 * (criterion 3). Nothing moves an overdue row anywhere else (criterion 4).
 *
 * A submission a colleague has open is greyed and named, and stays clickable
 * (criterion 7): the marker is a warning that two people are about to do the same work,
 * not a lock on the door. The one who ignores it still gets a real answer — the conflict
 * is caught at the verdict, where it can be reported with the colleague's outcome in hand.
 */
export function QueueRow({ item, slaHours, groupBy, selected, onSelect }: QueueRowProps) {
  const t = useTranslations('Review');
  const { words } = useAgeWords();

  const locked = item.lock !== null;
  const age = words(item.ageHours);
  // Without a promise there is nothing to be late against, so the rail falls to its
  // thinnest neutral rather than guessing a school default that may not exist.
  const sla = slaHours ?? 0;
  const overdue = slaHours !== null && item.overdue;

  const lead = groupBy === 'exercise' ? item.student.name : item.exerciseTitle;
  const support = groupBy === 'exercise' ? item.student.groupName : item.student.name;

  const label = [
    t('inbox.row.label', {
      student: item.student.name ?? item.student.id,
      exercise: item.exerciseTitle ?? t('inbox.row.exerciseGone'),
      age,
    }),
    locked ? t('inbox.row.lockedByLabel', { name: item.lock?.teacherName ?? '' }) : null,
    !locked && item.autoClean ? t('inbox.row.autoClean') : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <li>
      <button
        type="button"
        aria-label={label}
        aria-current={selected ? 'true' : undefined}
        onClick={() => onSelect(item.id)}
        style={selected ? { borderColor: 'var(--ssz-text-accent)' } : undefined}
        className={cn(
          'flex w-full items-center gap-[11px] rounded-[11px] border-[1.5px] border-transparent',
          'py-2.5 pl-2.5 pr-3 text-left outline-none transition-colors',
          'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
          selected ? 'bg-accent/10' : 'hover:bg-(--ssz-bg-subtle)',
        )}
      >
        <span
          aria-hidden
          className="min-h-[34px] shrink-0 self-stretch rounded-full"
          style={{ width: ageRail(item.ageHours, sla), background: ageTone(item.ageHours, sla) }}
        />

        <Avatar
          name={item.student.name ?? '?'}
          size="sm"
          className="size-[30px] text-[11px]"
          // A greyed avatar is the quietest way to say "somebody is already here"; the
          // name below carries the fact, the colour only draws the eye to it.
          color={locked ? 'var(--ssz-text-muted)' : undefined}
          aria-hidden
        />

        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13.5px] font-semibold">
            {lead ?? t('inbox.row.exerciseGone')}
          </span>
          {support === null && item.attemptNo <= 1 ? null : (
            <span className="mt-px block truncate text-[11.5px] text-muted-foreground">
              {support}
              {item.attemptNo > 1 ? (
                <span className="font-semibold text-warning-700 dark:text-warning-300">
                  {support === null ? '' : ' · '}
                  {t('inbox.row.attempt', { n: item.attemptNo })}
                </span>
              ) : null}
            </span>
          )}
        </span>

        <span className="shrink-0 text-right">
          <span
            className={cn(
              'block whitespace-nowrap text-[11.5px] font-semibold',
              overdue ? 'ssz-age-text' : 'text-muted-foreground',
            )}
            style={overdue ? ageTextVars(item.ageHours, sla) : undefined}
          >
            {age}
          </span>
          {locked ? (
            <span
              aria-hidden
              className="mt-0.5 flex items-center justify-end gap-1 text-[10.5px] text-muted-foreground"
            >
              <Lock className="h-2.5 w-2.5" />
              {t('inbox.row.lockedBy', { name: firstName(item.lock?.teacherName) })}
            </span>
          ) : item.autoClean ? (
            <span
              aria-hidden
              className="mt-0.5 block text-[10.5px] font-semibold text-success-700 dark:text-success-300"
            >
              {t('inbox.row.autoClean')}
            </span>
          ) : null}
        </span>
      </button>
    </li>
  );
}

/** The age's text tier as custom properties, so `.ssz-age-text` can pick per theme. */
function ageTextVars(hours: number, slaHours: number): React.CSSProperties {
  const { light, dark } = ageTextTone(hours, slaHours);
  return { '--age-text-light': light, '--age-text-dark': dark } as React.CSSProperties;
}

/** A colleague's given name is enough in a 352 px column, and reads less formally. */
function firstName(name: string | null | undefined): string {
  return (name ?? '').split(' ')[0] ?? '';
}

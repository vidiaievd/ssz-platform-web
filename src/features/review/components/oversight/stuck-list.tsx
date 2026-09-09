'use client';

import { useTranslations } from 'next-intl';
import { Eye, UserPlus } from 'lucide-react';

import { Button } from '@/components/ui/button';

import { AgeMark } from '../age-mark';
import { Panel } from '../primitives';
import { ageRail, ageTone } from '../../lib/age-scale';
import type { OversightStuck } from '../../types/oversight';

export interface StuckListProps {
  items: OversightStuck[];
  /** Opens the submission in the reviewing screen, on the administrator's own name. */
  reviewHref: (submissionId: string) => string;
  /** Offers the assignment form for this submission's group, or for a learner with none. */
  onAssign: (item: OversightStuck) => void;
}

/**
 * The work that has stopped moving, by name, with something to do about each row.
 *
 * Everything above this section describes; this is the only part that acts, and it is
 * deliberately last. An administrator opening the screen should read what is happening
 * before deciding anything, and the three actions here — remind, assign, review it
 * yourself — are the whole vocabulary of what can be done (criterion 30). Reminding is a
 * property of a person and lives on the teacher rows above; the two that concern one piece
 * of work live here.
 *
 * A submission from a learner in no group says so in words, in the row (criterion 31).
 * Nobody is responsible for it under the group rule, and it would otherwise be the one
 * kind of work that is invisible precisely because nothing is wrong with it.
 */
export function StuckList({ items, reviewHref, onAssign }: StuckListProps) {
  const t = useTranslations('Review.oversight.stuck');

  return (
    <Panel
      title={t('title')}
      sub={items.length === 0 ? t('emptySub') : t('sub', { n: items.length })}
      bodyClassName="p-3"
    >
      {items.length === 0 ? (
        <p className="px-2 py-1 text-[12.5px] text-muted-foreground">{t('empty')}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-center gap-3 rounded-[11px] border-[1.5px] border-border bg-(--ssz-bg-surface) px-3 py-[11px]"
            >
              {item.slaHours === null ? null : (
                <span
                  aria-hidden
                  className="min-h-8 shrink-0 self-stretch rounded-full"
                  style={{
                    width: ageRail(item.hours, item.slaHours),
                    background: ageTone(item.hours, item.slaHours),
                  }}
                />
              )}

              <div className="min-w-0 flex-1">
                <div className="truncate text-[13.5px] font-semibold">
                  {item.studentName ?? t('unnamedStudent')}
                  {' · '}
                  {item.exerciseTitle ?? t('unnamedExercise')}
                </div>
                <div className="mt-px truncate text-[11.5px] text-(--ssz-text-secondary)">
                  {item.unassigned ? (
                    <span className="font-semibold text-warning-700 dark:text-warning-300">
                      {t('noReviewer')}
                    </span>
                  ) : (
                    <>
                      {item.groupName ?? t('unnamedGroup')}
                      {item.teacherName === null ? '' : ` · ${item.teacherName}`}
                    </>
                  )}
                </div>
              </div>

              {item.slaHours === null ? null : (
                <AgeMark hours={item.hours} slaHours={item.slaHours} showOverdue={false} />
              )}

              <div className="flex shrink-0 gap-[7px]">
                <Button variant="ghost" size="sm" onClick={() => onAssign(item)}>
                  <UserPlus aria-hidden className="size-3.5" />
                  {t('assign')}
                </Button>
                {/* A link, not a handler: "review it yourself" is a place, and it should
                    open in a new tab as readily as any other row of a list. */}
                <Button variant="outline" size="sm" asChild>
                  <a href={reviewHref(item.id)}>
                    <Eye aria-hidden className="size-3.5" />
                    {t('reviewIt')}
                  </a>
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

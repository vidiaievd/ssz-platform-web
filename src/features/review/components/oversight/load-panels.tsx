'use client';

import { useTranslations } from 'next-intl';

import { AgeSpread } from '../age-spread';
import { Panel } from '../primitives';
import { ageTone } from '../../lib/age-scale';
import type { OversightCourse, OversightGroup } from '../../types/oversight';

/**
 * The same load, cut two other ways: by group and by course.
 *
 * Both are compact on purpose. The teacher rows above answer "who needs help"; these two
 * answer the follow-up questions — *which class* has stopped moving, and *which course*
 * promised something it is not keeping — and a full-size row for each would push the work
 * that is actually stuck off the bottom of the screen.
 */

export interface GroupLoadPanelProps {
  groups: OversightGroup[];
  slaHours: number | null;
}

export function GroupLoadPanel({ groups, slaHours }: GroupLoadPanelProps) {
  const t = useTranslations('Review.oversight.groups');

  return (
    <Panel title={t('title')} sub={t('sub')}>
      {groups.length === 0 ? (
        <p className="text-[12.5px] text-muted-foreground">{t('empty')}</p>
      ) : (
        <div className="flex flex-col gap-3">
          {groups.map((group) => (
            <div key={group.id} className="flex items-center gap-3">
              <div className="w-[150px] shrink-0 truncate text-[13px] font-semibold">
                {group.name ?? t('unnamed')}
              </div>
              <div className="min-w-0 flex-1">
                {slaHours === null ? null : (
                  <AgeSpread hours={group.ages} slaHours={slaHours} height={8} className="w-full" />
                )}
              </div>
              <div className="w-[78px] shrink-0 text-right text-xs text-(--ssz-text-secondary)">
                {group.pending}
                {' · '}
                <span
                  className="font-semibold"
                  style={
                    group.overdue === 0 || slaHours === null
                      ? { color: 'var(--ssz-text-muted)' }
                      : { color: ageTone(slaHours * 1.6, slaHours) }
                  }
                >
                  {group.overdue}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

export interface CourseLoadPanelProps {
  courses: OversightCourse[];
}

/**
 * Courses, each with the promise its submissions are actually held to.
 *
 * The promise is printed on every row, not only on the ones that override, because the
 * number beside "longer than promised" means nothing without it — and where a course sets
 * its own, the row says so, so that a figure differing from the school's does not read as
 * an inconsistency (`BEHAVIOR.md` §C).
 */
export function CourseLoadPanel({ courses }: CourseLoadPanelProps) {
  const t = useTranslations('Review.oversight.courses');

  return (
    <Panel title={t('title')} sub={t('sub')}>
      {courses.length === 0 ? (
        <p className="text-[12.5px] text-muted-foreground">{t('empty')}</p>
      ) : (
        <div className="flex flex-col gap-3.5">
          {courses.map((course) => (
            <div key={course.id} className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-semibold">
                  {course.name ?? t('unnamed')}
                </div>
                <div className="text-[11.5px] text-muted-foreground">
                  {course.slaHours === null ? t('noPromise') : t('promise', { n: course.slaHours })}
                  {course.overridden ? ` · ${t('overridden')}` : ''}
                </div>
              </div>
              <div className="shrink-0 text-[13px] text-(--ssz-text-secondary)">
                {t('pending', { n: course.pending })}
                {' · '}
                <span
                  className="font-semibold"
                  style={
                    course.overdue === 0 || course.slaHours === null
                      ? { color: 'var(--ssz-text-muted)' }
                      : { color: ageTone(course.slaHours * 1.6, course.slaHours) }
                  }
                >
                  {course.overdue}
                </span>
              </div>
            </div>
          ))}
          <p className="text-[11.5px] text-muted-foreground">{t('legend')}</p>
        </div>
      )}
    </Panel>
  );
}

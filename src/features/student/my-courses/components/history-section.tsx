'use client';

import { Archive } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';

import { useMyHistory } from '@/features/student/api/use-my-history';
import { Link } from '@/lib/i18n/navigation';

/**
 * Finished courses, read only (plan 90, live check, Q15): what is left of a purged school's
 * course (Q11) and any course the learner completed. A course gone for them is named as
 * unavailable, not dropped. `shownIds` — courses the main grid already draws; they are not
 * repeated here.
 */
export function HistorySection({ shownIds }: { shownIds: ReadonlySet<string> }) {
  const t = useTranslations('Student.myCoursesPage.history');
  const format = useFormatter();
  const { data } = useMyHistory();

  const items = (data ?? []).filter((i) => !shownIds.has(i.containerId));
  if (items.length === 0) return null;

  return (
    <section className="mt-8" data-testid="history-section" aria-labelledby="history-title">
      <h2 id="history-title" className="text-[15px] font-semibold text-(--ssz-text-primary)">
        {t('title')}
      </h2>
      <p className="mt-0.5 text-[13px] text-(--ssz-text-muted)">{t('subtitle')}</p>
      <ul className="mt-3 grid gap-3 grid-cols-[repeat(auto-fill,minmax(280px,1fr))]">
        {items.map(({ containerId, completedAt, course }) => {
          const date = completedAt ? format.dateTime(new Date(completedAt), { dateStyle: 'medium' }) : null;
          const body = (
            <>
              <Archive className="mt-0.5 size-4 shrink-0 text-(--ssz-text-muted)" aria-hidden="true" />
              <div className="min-w-0">
                <p className="truncate text-[14px] font-semibold text-(--ssz-text-primary)">
                  {course ? course.title : t('unavailable')}
                </p>
                <p className="mt-0.5 text-[13px] text-(--ssz-text-muted)">
                  {course
                    ? [course.level, date ? t('finished', { date }) : null].filter(Boolean).join(' · ')
                    : t('unavailableNote')}
                </p>
              </div>
            </>
          );
          const box = 'flex items-start gap-2.5 rounded-lg border-[1.5px] border-(--ssz-border-default) bg-surface px-4 py-3';
          return (
            <li key={containerId}>
              {course ? (
                <Link href={`/student/courses/${containerId}`} className={`${box} hover:border-(--ssz-border-strong)`}>
                  {body}
                </Link>
              ) : (
                <div className={box} data-testid="history-unavailable">
                  {body}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

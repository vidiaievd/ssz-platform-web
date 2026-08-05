'use client';

import { Calendar } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';

import type { UpcomingReview } from '@/features/learning/types';
import { langHue } from '@/features/student/lib/lang-hue';

interface ComingUpCardProps {
  upcoming: UpcomingReview[];
}

/**
 * The look-ahead schedule. learning-service's due queue only returns cards due
 * at or before now, so this list is empty until it can serve future-dated
 * cards — the card then says so plainly rather than inventing a schedule.
 */
export function ComingUpCard({ upcoming }: ComingUpCardProps) {
  const t = useTranslations('Student.reviewsPage.comingUp');
  const format = useFormatter();

  return (
    <div className="rounded-lg border-[1.5px] border-(--ssz-border-default) bg-surface p-4.5 shadow-(--ssz-shadow-xs)">
      <div className="mb-4 flex items-center gap-2.25">
        <Calendar size={18} className="text-(--ssz-text-secondary)" aria-hidden="true" />
        <h2 className="text-[15px] font-bold tracking-[-0.01em] text-(--ssz-text-primary)">
          {t('title')}
        </h2>
      </div>

      {upcoming.length === 0 ? (
        <p className="text-[12.5px] leading-relaxed text-(--ssz-text-secondary)">{t('empty')}</p>
      ) : (
        <div className="flex flex-col">
          {upcoming.map((row, i) => {
            const hue = langHue(row.language);
            return (
              <div
                key={`${row.courseId}:${row.dueAt}`}
                className={`flex items-center gap-2.75 py-2.75 ${
                  i ? 'border-t border-(--ssz-border-default)' : ''
                }`}
              >
                <span
                  className="size-2 shrink-0 rounded-full"
                  style={{ background: hue.c }}
                  aria-hidden="true"
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-semibold text-(--ssz-text-primary)">
                    {row.courseTitle}
                  </div>
                  <div className="text-[11.5px] text-(--ssz-text-muted)">
                    {format.relativeTime(new Date(row.dueAt))}
                  </div>
                </div>
                <span className="text-[13px] font-bold text-(--ssz-text-secondary)">
                  {row.count}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

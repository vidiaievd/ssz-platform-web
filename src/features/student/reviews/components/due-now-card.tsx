'use client';

import { Repeat } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import type { ReviewCourseBreakdown, ReviewsSummary } from '@/features/learning/types';
import { LangChip } from '@/features/student/home/components';
import { langHue } from '@/features/student/lib/lang-hue';
import { Link } from '@/lib/i18n/navigation';

interface DueNowCardProps {
  summary: ReviewsSummary;
  onReviewAll: () => void;
}

function BreakdownRow({ row, isFirst }: { row: ReviewCourseBreakdown; isFirst: boolean }) {
  const t = useTranslations('Student.reviewsPage');
  const hue = langHue(row.language);

  return (
    <div
      className={`flex flex-wrap items-center gap-3.5 px-3 py-3.5 ${
        isFirst ? '' : 'border-t border-(--ssz-border-default)'
      }`}
    >
      <LangChip langCode={row.language} level={row.level ?? ''} size={40} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-(--ssz-text-primary)">
          {row.courseTitle}
        </div>
        <div className="mt-0.25 text-[12.5px] text-(--ssz-text-muted)">{t(`kind.${row.kind}`)}</div>
      </div>
      <div className="text-right">
        <div className="text-base font-bold" style={{ color: hue.deep }}>
          {row.dueCount}
        </div>
        <div className="text-[11px] text-(--ssz-text-muted)">{t('due')}</div>
      </div>
      {/* The SRS session cannot be scoped to one course, so this opens the
          course rather than promising a filtered review. */}
      <Button asChild size="sm" variant="outline">
        <Link href={`/student/courses/${row.courseId}`}>{t('openCourse')}</Link>
      </Button>
    </div>
  );
}

/** Amber "N items due now" header plus the per-course, per-kind breakdown. */
export function DueNowCard({ summary, onReviewAll }: DueNowCardProps) {
  const t = useTranslations('Student.reviewsPage');

  return (
    <div className="overflow-hidden rounded-lg border-[1.5px] border-(--ssz-border-default) bg-surface shadow-(--ssz-shadow-sm)">
      <div
        className="flex flex-wrap items-center gap-4 border-b p-5"
        style={{
          background: 'oklch(0.95 0.045 82)',
          borderBottomColor: 'oklch(0.66 0.11 70 / 0.25)',
        }}
      >
        <div className="flex items-baseline gap-2.5">
          <span
            className="text-[30px] leading-none font-extrabold tracking-[-0.03em]"
            style={{ color: 'oklch(0.42 0.09 82)' }}
          >
            {summary.totalDue}
          </span>
          <span className="text-sm font-semibold" style={{ color: 'oklch(0.44 0.09 82)' }}>
            {t('dueNow', { count: summary.totalDue })}
          </span>
        </div>
        <div className="flex-1" />
        <Button variant="primary" size="sm" onClick={onReviewAll}>
          <Repeat size={15} aria-hidden="true" />
          {t('reviewAll')}
        </Button>
      </div>

      {summary.overdueCount > 0 && (
        <p className="border-b border-(--ssz-border-default) px-4 py-2.5 text-[12.5px] text-(--ssz-text-secondary)">
          {t('overdue', { count: summary.overdueCount })}
        </p>
      )}

      <div className="p-2">
        {summary.breakdown.map((row, i) => (
          <BreakdownRow key={`${row.courseId}:${row.kind}`} row={row} isFirst={i === 0} />
        ))}
        {summary.unattributedDue > 0 && (
          <p
            className={`px-3 py-3.5 text-[12.5px] text-(--ssz-text-muted) ${
              summary.breakdown.length ? 'border-t border-(--ssz-border-default)' : ''
            }`}
          >
            {t('unattributed', { count: summary.unattributedDue })}
          </p>
        )}
      </div>
    </div>
  );
}

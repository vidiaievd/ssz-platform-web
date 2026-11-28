import { useTranslations } from 'next-intl';
import { TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react';

import { WidgetCard } from './widget-card';
import { WidgetEmptyState } from './widget-empty-state';
import type { WidgetData, CourseHealthRow, Trend } from '../types';

function completionColor(pct: number): string {
  if (pct >= 0.7) return 'bg-success-500';
  if (pct >= 0.5) return 'bg-warning-500';
  return 'bg-error-500';
}

function TrendIndicator({ trend }: { trend: Trend }) {
  const t = useTranslations('School.dashboard.courseHealth');
  if (trend === 'up') return <TrendingUp className="size-4 text-success-600" aria-label={t('up')} />;
  if (trend === 'down') return <TrendingDown className="size-4 text-error-600" aria-label={t('down')} />;
  return <Minus className="size-4 text-(--ssz-text-muted)" aria-label={t('flat')} />;
}

type CourseHealthProps = {
  courseHealth: WidgetData<CourseHealthRow[]>;
};

export function CourseHealth({ courseHealth }: CourseHealthProps) {
  const t = useTranslations('School.dashboard.courseHealth');
  if (courseHealth.status === 'unavailable') {
    return <WidgetCard title={t('title')} unavailable />;
  }

  const courses = courseHealth.status === 'ok' ? courseHealth.data : [];

  return (
    <WidgetCard
      title={t('title')}
      subtitle={t('subtitle')}
      empty={
        courses.length === 0 ? (
          <WidgetEmptyState title={t('emptyTitle')} body={t('emptyBody')} />
        ) : undefined
      }
    >
      {courses.length > 0 && (
        <div className="space-y-3 -mx-4 -mb-4">
          {courses.map((course) => {
            const pct = Math.round(course.completion * 100);
            return (
              <div
                key={course.id}
                className="px-4 py-3 border-b border-border last:border-0"
              >
                {/* Desktop: grid layout */}
                <div className="hidden md:grid md:grid-cols-[36px_1fr_56px_120px_40px] md:items-center md:gap-3">
                  <span className="inline-flex items-center justify-center rounded text-[11px] font-bold bg-muted text-(--ssz-text-secondary) h-6 w-9 uppercase">
                    {course.lang}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-(--ssz-text-primary) truncate">{course.name}</p>
                  </div>
                  <span className="font-mono text-sm text-(--ssz-text-secondary) text-right">
                    {course.students}
                  </span>
                  <div>
                    <div
                      role="progressbar"
                      aria-valuenow={pct}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={t('completion', { name: course.name, pct })}
                      className="h-2 rounded-full bg-muted overflow-hidden"
                    >
                      <div
                        className={`h-full rounded-full ${completionColor(course.completion)}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="font-mono text-[11px] text-(--ssz-text-muted)">{pct}%</span>
                  </div>
                  <div className="flex items-center justify-end gap-1">
                    <TrendIndicator trend={course.trend} />
                    {course.flag === 'dropoff' && (
                      <AlertTriangle className="size-3.5 text-warning-600" aria-label={t('dropoff')} />
                    )}
                  </div>
                </div>

                {/* Mobile: stacked card */}
                <div className="md:hidden">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center justify-center rounded text-[11px] font-bold bg-muted text-(--ssz-text-secondary) h-5 w-8 uppercase">
                        {course.lang}
                      </span>
                      <p className="text-sm font-medium text-(--ssz-text-primary)">{course.name}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <TrendIndicator trend={course.trend} />
                      {course.flag === 'dropoff' && (
                        <AlertTriangle className="size-3.5 text-warning-600" aria-label={t('dropoff')} />
                      )}
                    </div>
                  </div>
                  <div
                    role="progressbar"
                    aria-valuenow={pct}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={t('completion', { name: course.name, pct })}
                    className="h-1.5 rounded-full bg-muted overflow-hidden"
                  >
                    <div
                      className={`h-full rounded-full ${completionColor(course.completion)}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className="mt-1 font-mono text-[11px] text-(--ssz-text-muted)">
                    {t('line', { pct, count: course.students })}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </WidgetCard>
  );
}

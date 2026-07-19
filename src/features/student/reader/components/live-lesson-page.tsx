'use client';

import { ExternalLink } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';

import { ErrorState, LearningSkeleton } from '@/features/learning';
import { useLesson } from '@/features/content';
import { formatDate } from '@/lib/i18n/formatters';
import type { Locale } from '@/lib/i18n/config';

export interface LiveLessonPageProps {
  lessonId: string;
  unitPosition: number;
  courseTitle: string;
}

function ScheduleRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 text-[13.5px]">
      <span className="text-(--ssz-text-muted)">{label}</span>
      <span className="font-semibold text-(--ssz-text-primary)">{value}</span>
    </div>
  );
}

export function LiveLessonPage({ lessonId, unitPosition, courseTitle }: LiveLessonPageProps) {
  const t = useTranslations('Learning.reader.live.page');
  const tSchedule = useTranslations('Learning.reader.live.schedule');
  const tNote = useTranslations('Learning.reader.live');
  const tContent = useTranslations('Content');
  const locale = useLocale() as Locale;

  const lesson = useLesson(lessonId);

  if (lesson.isLoading) {
    return <LearningSkeleton variant="card" rows={4} />;
  }

  if (lesson.isError || !lesson.data) {
    return <ErrorState onRetry={() => lesson.refetch()} />;
  }

  const { title, liveStartsAt, liveDurationMinutes, liveCapacity, liveJoinUrl } = lesson.data;
  const startsAtDate = liveStartsAt ? new Date(liveStartsAt) : null;

  return (
    <div>
      <div className="mb-4.5">
        <div className="mb-1.5 text-[11px] font-bold tracking-wider text-(--ssz-color-primary-600) uppercase">
          {t('eyebrow', { unit: unitPosition, course: courseTitle, type: tContent('materialType.live') })}
        </div>
        <h1 className="font-reading mb-1.5 text-[29px] leading-[1.15] font-semibold tracking-tight text-(--ssz-text-primary)">
          {title}
        </h1>
      </div>

      {startsAtDate ? (
        <div className="flex flex-col gap-2.5 rounded-2xl border-[1.5px] border-(--ssz-border-default) bg-surface px-6 py-5.5 shadow-(--ssz-shadow-sm)">
          <ScheduleRow label={tSchedule('date')} value={formatDate(startsAtDate, locale, { dateStyle: 'medium' })} />
          <ScheduleRow label={tSchedule('time')} value={formatDate(startsAtDate, locale, { timeStyle: 'short' })} />
          {liveDurationMinutes != null && (
            <ScheduleRow
              label={tSchedule('duration')}
              value={tSchedule('durationMinutes', { minutes: liveDurationMinutes })}
            />
          )}
          {liveCapacity != null && <ScheduleRow label={tSchedule('capacity')} value={String(liveCapacity)} />}
          {liveJoinUrl && (
            <a
              href={liveJoinUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1.5 inline-flex items-center justify-center gap-2 rounded-xl bg-(--ssz-color-primary-500) px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-(--ssz-color-primary-600) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ssz-border-focus)"
              style={{ transitionDuration: 'var(--ssz-duration-fast)' }}
            >
              {tSchedule('join')}
              <ExternalLink size={14} aria-hidden="true" />
            </a>
          )}
        </div>
      ) : (
        <div className="flex min-h-[40vh] flex-col items-center justify-center gap-2 rounded-2xl border border-(--ssz-border-default) bg-surface px-6 py-16 text-center">
          <p className="text-lg font-medium text-(--ssz-text-primary)">{t('noScheduleTitle')}</p>
          <p className="text-sm text-(--ssz-text-muted)">{t('noScheduleBody')}</p>
        </div>
      )}

      <p className="mt-5.5 text-[13.5px] leading-[1.6] text-(--ssz-text-secondary)">{tNote('note')}</p>
    </div>
  );
}

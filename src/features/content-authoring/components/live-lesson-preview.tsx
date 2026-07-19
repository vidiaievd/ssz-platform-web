'use client';

import { useLocale, useTranslations } from 'next-intl';

import { formatDate } from '@/lib/i18n/formatters';
import type { Locale } from '@/lib/i18n/config';

interface LiveLessonPreviewProps {
  title: string;
  liveStartsAt: string | null;
  liveDurationMinutes: number | null;
  liveCapacity: number | null;
  liveJoinUrl: string | null;
}

function ScheduleRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-[13.5px]">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold text-(--ssz-text-primary)">{value}</span>
    </div>
  );
}

/** Live "exactly what the learner sees" preview for a LIVE-kind lesson, rendered inside `PhoneFrame`. */
export function LiveLessonPreview({
  title,
  liveStartsAt,
  liveDurationMinutes,
  liveCapacity,
  liveJoinUrl,
}: LiveLessonPreviewProps) {
  const t = useTranslations('Authoring');
  const locale = useLocale() as Locale;

  const startsAtDate = liveStartsAt ? new Date(liveStartsAt) : null;

  return (
    <div>
      <div className="border-b border-(--ssz-border-default) bg-surface px-4 pb-3 pt-4">
        <div className="text-[17px] font-bold tracking-tight text-(--ssz-text-primary)">
          {title || t('lessons.untitled')}
        </div>
      </div>

      <div className="px-4 py-3.5">
        {startsAtDate ? (
          <div className="flex flex-col gap-2.5 rounded-xl border border-(--ssz-border-default) bg-surface p-4">
            <ScheduleRow
              label={t('editor.liveDate')}
              value={formatDate(startsAtDate, locale, { dateStyle: 'medium' })}
            />
            <ScheduleRow
              label={t('editor.liveTime')}
              value={formatDate(startsAtDate, locale, { timeStyle: 'short' })}
            />
            {liveDurationMinutes != null && (
              <ScheduleRow
                label={t('editor.liveDuration')}
                value={t('editor.liveDurationMinutes', { minutes: liveDurationMinutes })}
              />
            )}
            {liveCapacity != null && (
              <ScheduleRow label={t('editor.liveCapacity')} value={String(liveCapacity)} />
            )}
            {liveJoinUrl && <ScheduleRow label={t('editor.liveJoinUrl')} value={liveJoinUrl} />}
          </div>
        ) : (
          <p className="italic text-muted-foreground">{t('editor.livePreviewNoSchedule')}</p>
        )}
      </div>
    </div>
  );
}

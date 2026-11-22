import { useTranslations } from 'next-intl';
import { BookOpen, FileText } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { WidgetCard } from './widget-card';
import { WidgetEmptyState } from './widget-empty-state';
import type { WidgetData, ReviewQueueItem } from '../types';

const KIND_ICON: Record<ReviewQueueItem['kind'], LucideIcon> = {
  lesson: BookOpen,
  rubric: FileText,
};

type ReviewQueueCardProps = {
  reviewQueue: WidgetData<ReviewQueueItem[]>;
};

export function ReviewQueueCard({ reviewQueue }: ReviewQueueCardProps) {
  const t = useTranslations('School.dashboard.review');
  if (reviewQueue.status === 'unavailable') {
    return <WidgetCard title={t('title')} unavailable />;
  }

  const items = reviewQueue.status === 'ok' ? reviewQueue.data : [];

  if (items.length === 0) {
    return (
      <WidgetCard title={t('title')} subtitle={t('subtitle')}>
        <WidgetEmptyState title={t('emptyTitle')} body={t('emptyBody')} />
      </WidgetCard>
    );
  }

  return (
    <WidgetCard
      title={t('title')}
      subtitle={t('subtitle')}
      headerRight={
        <span className="inline-flex items-center justify-center size-5 rounded-full bg-error-100 text-[11px] font-bold text-error-700">
          {items.length}
        </span>
      }
    >
      <ul
        role="list"
        aria-label={t('title')}
        className="divide-y divide-border -mx-4 -mb-4"
      >
        {items.map((item) => {
          const Icon = KIND_ICON[item.kind];
          return (
            <li key={item.id} className="flex items-center gap-3 px-4 py-3">
              <Icon className="size-4 shrink-0 text-(--ssz-text-muted)" aria-hidden="true" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-(--ssz-text-primary) truncate">{item.title}</p>
                <p className="font-mono text-[11px] text-(--ssz-text-muted) truncate">
                  {t('by', { author: item.author, age: item.age })}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </WidgetCard>
  );
}

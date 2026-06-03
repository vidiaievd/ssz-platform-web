import { BookOpen, FileText, ExternalLink } from 'lucide-react';
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
  if (reviewQueue.status === 'unavailable') {
    return <WidgetCard title="Needs your review" loading />;
  }

  const items = reviewQueue.status === 'ok' ? reviewQueue.data : [];

  if (items.length === 0) {
    return (
      <WidgetCard title="Needs your review" subtitle="Owner approval required to publish">
        <WidgetEmptyState title="All caught up!" body="No content is waiting for your review." />
      </WidgetCard>
    );
  }

  return (
    <WidgetCard
      title="Needs your review"
      subtitle="Owner approval required to publish"
      headerRight={
        <span className="inline-flex items-center justify-center size-5 rounded-full bg-error-100 text-[11px] font-bold text-error-700">
          {items.length}
        </span>
      }
    >
      <ul
        role="list"
        aria-label="Review queue"
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
                  by {item.author} · {item.age}
                </p>
              </div>
              <a
                href="#" // TODO: link to review surface
                className="shrink-0 flex items-center gap-1 text-xs font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                aria-label={`Open ${item.title} for review`}
              >
                Open <ExternalLink className="size-3" aria-hidden="true" />
              </a>
            </li>
          );
        })}
      </ul>
    </WidgetCard>
  );
}

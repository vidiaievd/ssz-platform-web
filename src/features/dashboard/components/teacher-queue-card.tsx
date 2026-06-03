import { Pen, Mic, ClipboardList } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { WidgetCard } from './widget-card';
import { WidgetEmptyState } from './widget-empty-state';

type TeacherQueueItem = {
  id: string;
  who: string;
  what: string;
  age: string;
  kind: 'pen' | 'mic';
};

const KIND_ICON: Record<TeacherQueueItem['kind'], LucideIcon> = {
  pen: Pen,
  mic: Mic,
};

type TeacherQueueCardProps = {
  items: TeacherQueueItem[];
  loading?: boolean;
};

export function TeacherQueueCard({ items, loading }: TeacherQueueCardProps) {
  return (
    <WidgetCard
      title="Grade queue"
      subtitle="Submissions awaiting your review"
      loading={loading}
      empty={
        !loading && items.length === 0 ? (
          <WidgetEmptyState
            icon={ClipboardList}
            title="Nothing to grade yet"
            body="New student submissions will appear here."
          />
        ) : undefined
      }
    >
      {items.length > 0 && (
        <ul role="list" aria-label="Grade queue" className="divide-y divide-border -mx-4 -mb-4">
          {items.map((item) => {
            const Icon = KIND_ICON[item.kind];
            return (
              <li key={item.id} className="flex items-center gap-3 px-4 py-3 min-h-[44px]">
                <span
                  className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary"
                  aria-hidden="true"
                >
                  {item.who.charAt(0).toUpperCase()}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-(--ssz-text-primary) truncate">{item.who}</p>
                  <p className="font-mono text-[11px] text-(--ssz-text-muted) truncate">
                    {item.what} · {item.age}
                  </p>
                </div>
                <Icon className="size-4 shrink-0 text-(--ssz-text-muted)" aria-label={item.kind === 'pen' ? 'writing submission' : 'speaking submission'} />
              </li>
            );
          })}
        </ul>
      )}
    </WidgetCard>
  );
}

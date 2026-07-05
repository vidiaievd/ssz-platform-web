'use client';

import { useState } from 'react';
import {
  Check,
  User,
  Flag,
  Star,
  BookOpen,
  Activity,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';
import { WidgetCard } from './widget-card';
import { WidgetEmptyState } from './widget-empty-state';
import { ActivityFilters, type ActivityTag } from './activity-filters';
import type { WidgetData, ActivityItem } from '../types';

const ICON_MAP: Record<ActivityItem['iconKey'], LucideIcon> = {
  check: Check,
  user: User,
  flag: Flag,
  star: Star,
  book: BookOpen,
};

const TONE_BORDER: Record<ActivityItem['tone'], string> = {
  success: 'border-l-success-500',
  primary: 'border-l-primary',
  warning: 'border-l-warning-500',
  neutral: 'border-l-border',
};

const TONE_ICON_BG: Record<ActivityItem['tone'], string> = {
  success: 'bg-success-100 text-success-700',
  primary: 'bg-primary/10 text-primary',
  warning: 'bg-warning-100 text-warning-700',
  neutral: 'bg-neutral-100 text-neutral-600',
};

type ActivityFeedProps = {
  activity: WidgetData<ActivityItem[]>;
};

function formatTime(iso: string): string {
  try {
    const diffMs = Date.now() - new Date(iso).getTime();
    const diffMin = Math.floor(diffMs / 60_000);
    if (diffMin < 1) return 'just now';
    if (diffMin < 60) return `${diffMin} min ago`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `${diffH} h ago`;
    return `${Math.floor(diffH / 24)} d ago`;
  } catch {
    return iso;
  }
}

export function ActivityFeed({ activity }: ActivityFeedProps) {
  const [activeFilter, setActiveFilter] = useState<ActivityTag>('all');

  const headerRight = (
    <ActivityFilters onFilterChange={setActiveFilter} />
  );

  if (activity.status === 'unavailable') {
    return (
      <WidgetCard title="Recent activity" loading />
    );
  }

  const items = activity.status === 'ok' ? activity.data : [];
  const filtered =
    activeFilter === 'all' ? items : items.filter((i) => i.tag === activeFilter);

  return (
    <WidgetCard
      title="Recent activity"
      headerRight={headerRight}
      empty={
        items.length === 0 ? (
          <WidgetEmptyState
            icon={Activity}
            title="Nothing has happened yet"
            body="Activity will appear here as your school grows."
          />
        ) : undefined
      }
    >
      {items.length > 0 && (
        <ul
          role="list"
          aria-label="Activity feed"
          className="divide-y divide-border -mx-4 -mb-4"
        >
          {filtered.map((item) => {
            const Icon = ICON_MAP[item.iconKey];
            return (
              <li
                key={item.id}
                className={cn(
                  'flex items-start gap-3 px-4 py-3 border-l-2',
                  TONE_BORDER[item.tone],
                )}
              >
                <span
                  className={cn(
                    'mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-full text-xs',
                    TONE_ICON_BG[item.tone],
                  )}
                  aria-hidden="true"
                >
                  <Icon className="size-3.5" />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm leading-snug">
                    <span className="font-semibold text-(--ssz-text-primary)">{item.who}</span>{' '}
                    <span className="text-(--ssz-text-muted)">{item.what}</span>{' '}
                    <span className="text-primary font-medium">{item.target}</span>
                  </p>
                  <time
                    dateTime={item.time}
                    className="font-mono text-[11px] text-(--ssz-text-muted) mt-0.5 block"
                  >
                    {formatTime(item.time)}
                  </time>
                </div>
                {item.tag && item.tag !== 'milestone' && (
                  <span className="shrink-0 rounded-full bg-neutral-100 px-1.5 py-0.5 text-[10px] font-medium text-neutral-600 capitalize">
                    {item.tag}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {filtered.length === 0 && items.length > 0 && (
        <p className="text-sm text-(--ssz-text-muted) py-4 text-center">
          No {activeFilter} activity yet.
        </p>
      )}

      {items.length > 0 && (
        <div className="mt-3 -mx-4 -mb-4 px-4 py-2 border-t border-border">
          <a
            href="#" // plan-28: deferred — audit log page not built yet
            className="text-xs font-medium text-primary hover:underline"
          >
            See full audit log →
          </a>
        </div>
      )}
    </WidgetCard>
  );
}

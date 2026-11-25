'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
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
import { activityWording } from '../lib/activity-wording';
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

type Translate = ReturnType<typeof useTranslations<'School.dashboard.activity'>>;

function formatTime(iso: string, t: Translate): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(diffMs)) return iso;
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return t('time.justNow');
  if (diffMin < 60) return t('time.minutes', { count: diffMin });
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return t('time.hours', { count: diffH });
  return t('time.days', { count: Math.floor(diffH / 24) });
}

/** A known word is translated; one we have no word for (a new role, outcome) stays as stored. */
function known(t: Translate, group: 'roles' | 'outcomes', value: string): string {
  const key = `${group}.${value}` as Parameters<Translate>[0];
  return t.has(key) ? t(key) : value;
}

function describe(item: ActivityItem, t: Translate): string {
  const wording = activityWording(item.eventType, item.what);
  switch (wording.key) {
    case 'joined':
      return t('what.joined', { role: known(t, 'roles', wording.role) });
    case 'reviewed':
      return t('what.reviewed', { outcome: known(t, 'outcomes', wording.outcome) });
    case null:
      return wording.raw;
    case 'enrolled':
      // A course content no longer describes comes without a title: name it as "a course"
      // instead of leaving the sentence hanging.
      return t(item.target ? 'what.enrolled' : 'what.enrolledCourse');
    default:
      return t(`what.${wording.key}`);
  }
}

export function ActivityFeed({ activity }: ActivityFeedProps) {
  const t = useTranslations('School.dashboard.activity');
  const [activeFilter, setActiveFilter] = useState<ActivityTag>('all');

  const headerRight = (
    <ActivityFilters onFilterChange={setActiveFilter} />
  );

  if (activity.status === 'unavailable') {
    return <WidgetCard title={t('title')} unavailable />;
  }

  const items = activity.status === 'ok' ? activity.data : [];
  const filtered =
    activeFilter === 'all' ? items : items.filter((i) => i.tag === activeFilter);

  return (
    <WidgetCard
      title={t('title')}
      headerRight={headerRight}
      empty={
        items.length === 0 ? (
          <WidgetEmptyState
            icon={Activity}
            title={t('emptyTitle')}
            body={t('emptyBody')}
          />
        ) : undefined
      }
    >
      {items.length > 0 && (
        <ul
          role="list"
          aria-label={t('feedLabel')}
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
                    <span className="font-semibold text-(--ssz-text-primary)">
                      {item.who ?? t('someone')}
                    </span>{' '}
                    <span className="text-(--ssz-text-muted)">{describe(item, t)}</span>{' '}
                    <span className="text-primary font-medium">{item.target}</span>
                  </p>
                  <time
                    dateTime={item.time}
                    className="font-mono text-[11px] text-(--ssz-text-muted) mt-0.5 block"
                  >
                    {formatTime(item.time, t)}
                  </time>
                </div>
                {item.tag && item.tag !== 'milestone' && (
                  <span className="shrink-0 rounded-full bg-neutral-100 px-1.5 py-0.5 text-[10px] font-medium text-neutral-600">
                    {t(`filters.${item.tag}`)}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {filtered.length === 0 && items.length > 0 && (
        <p className="text-sm text-(--ssz-text-muted) py-4 text-center">
          {t('noneFiltered')}
        </p>
      )}

    </WidgetCard>
  );
}

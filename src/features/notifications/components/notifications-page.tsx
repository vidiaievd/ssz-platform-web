'use client';

import { useCallback, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';

import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  useArchive,
  useBulkAction,
  useDeleteNotification,
  useMarkAllRead,
  useMarkRead,
  useMarkUnread,
  useNotificationsList,
  useUnarchive,
} from '../api/use-notifications';
import { groupNotificationsByDay, type DayGroupLabel } from '../lib/group-by-day';
import type { NotificationLinkContext } from '../lib/notification-registry';
import type {
  Notification,
  NotificationCategory,
  NotificationFilter,
  NotificationType,
} from '../types';
import { NotificationListItem } from './notification-list-item';

const CATEGORY_TYPES: Record<NotificationCategory, NotificationType[]> = {
  Enrollment: [
    'ENROLLMENT_REQUEST',
    'ENROLLMENT_APPROVED',
    'ENROLLMENT_REJECTED',
    'PLACEMENT_REVIEW_READY',
    'GROUP_ASSIGNED',
  ],
  Staff: [
    'TEACHER_ABSENCE',
    'SUBSTITUTE_REQUEST',
    'SUBSTITUTE_ASSIGNED',
    'OVERLOAD_ALERT',
    'VACANCY_ALERT',
    'UNCOVERED_LESSON',
    'SCHOOL_INVITATION',
    'TEACHER_PROFILE_CHANGED',
  ],
  System: ['GENERAL', 'WELCOME_EMAIL', 'EMAIL_VERIFICATION', 'PASSWORD_RESET', 'PASSWORD_CHANGED', 'STUDY_REMINDER'],
};

function dayGroupTitle(label: DayGroupLabel, date: string, t: ReturnType<typeof useTranslations<'Notifications'>>, locale: string): string {
  if (label === 'today') return t('dayGroups.today');
  if (label === 'yesterday') return t('dayGroups.yesterday');
  return new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'long', day: 'numeric' }).format(
    new Date(date),
  );
}

export interface NotificationsPageProps {
  linkContext: NotificationLinkContext;
  locale: string;
}

export function NotificationsPage({ linkContext, locale }: NotificationsPageProps) {
  const t = useTranslations('Notifications');
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const filter = (searchParams.get('filter') as NotificationFilter | null) ?? 'all';
  const category = (searchParams.get('category') as NotificationCategory | null) ?? null;

  const { data, isLoading, isError, fetchNextPage, hasNextPage, isFetchingNextPage, refetch } =
    useNotificationsList({ filter });

  const markRead = useMarkRead();
  const markUnread = useMarkUnread();
  const markAllRead = useMarkAllRead();
  const archive = useArchive();
  const unarchive = useUnarchive();
  const remove = useDeleteNotification();
  const bulk = useBulkAction();

  const [selected, setSelected] = useState<Set<string>>(new Set());

  const allItems = useMemo(
    () => data?.pages.flatMap((page) => page.items) ?? [],
    [data],
  );
  const visibleItems = useMemo(
    () => (category ? allItems.filter((n) => CATEGORY_TYPES[category].includes(n.type)) : allItems),
    [allItems, category],
  );
  const unreadCount = data?.pages[0]?.unreadCount ?? 0;
  const dayGroups = useMemo(() => groupNotificationsByDay(visibleItems), [visibleItems]);

  const setParam = useCallback(
    (key: string, value: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) params.set(key, value);
      else params.delete(key);
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams],
  );

  function toggleSelected(id: string, isSelected: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (isSelected) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function clearSelection() {
    setSelected(new Set());
  }

  function openNotification(notification: Notification, href: string | undefined) {
    if (href) router.push(href);
  }

  async function runBulk(action: 'read' | 'archive' | 'delete') {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    try {
      await bulk.mutateAsync({ ids, action });
      toast.success(
        action === 'archive'
          ? t('toasts.archived')
          : action === 'delete'
            ? t('toasts.deleted')
            : t('toasts.markedRead'),
      );
      clearSelection();
    } catch {
      toast.error(t('toasts.actionFailed'));
    }
  }

  return (
    <div className="max-w-215 mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-semibold">{t('title')}</h1>
          {unreadCount > 0 && <Badge variant="primary">{unreadCount}</Badge>}
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                markAllRead.mutate();
              }}
            >
              {t('markAllAsRead')}
            </Button>
          )}
        </div>
      </div>
      <p className="text-sm text-muted-foreground">{t('subtitle')}</p>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs value={filter} onValueChange={(value) => setParam('filter', value === 'all' ? null : value)}>
          <TabsList>
            <TabsTrigger value="all">{t('tabs.all')}</TabsTrigger>
            <TabsTrigger value="unread">{t('tabs.unread')}</TabsTrigger>
            <TabsTrigger value="archived">{t('tabs.archived')}</TabsTrigger>
          </TabsList>
        </Tabs>

        <Select value={category ?? 'all'} onValueChange={(value) => setParam('category', value === 'all' ? null : value)}>
          <SelectTrigger className="w-44" size="sm">
            <SelectValue placeholder={t('filterAllTypes')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('filterAllTypes')}</SelectItem>
            <SelectItem value="Enrollment">{t('categories.Enrollment')}</SelectItem>
            <SelectItem value="Staff">{t('categories.Staff')}</SelectItem>
            <SelectItem value="System">{t('categories.System')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Bulk bar */}
      {visibleItems.length > 0 && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2">
          <div className="flex items-center gap-2">
            <Checkbox
              aria-label={t('selectAll')}
              checked={selected.size > 0 && selected.size === visibleItems.length}
              onCheckedChange={(checked) =>
                setSelected(checked === true ? new Set(visibleItems.map((n) => n.id)) : new Set())
              }
            />
            <span className="text-sm text-muted-foreground">
              {selected.size > 0 ? t('selectedCount', { count: selected.size }) : t('selectAll')}
            </span>
          </div>
          {selected.size > 0 && (
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => runBulk('read')}>
                {t('bulk.markRead')}
              </Button>
              <Button variant="outline" size="sm" onClick={() => runBulk('archive')}>
                {t('bulk.archive')}
              </Button>
              <Button variant="outline" size="sm" onClick={() => runBulk('delete')}>
                {t('bulk.delete')}
              </Button>
              <Button variant="ghost" size="sm" onClick={clearSelection}>
                {t('bulk.clear')}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* List */}
      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : isError ? (
        <Alert variant="error" title={t('error.title')}>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            {t('error.retry')}
          </Button>
        </Alert>
      ) : visibleItems.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-16 text-center text-sm text-muted-foreground">
          {category
            ? t('emptyState.category')
            : filter === 'unread'
              ? t('emptyState.unread')
              : filter === 'archived'
                ? t('emptyState.archived')
                : t('emptyState.all')}
        </div>
      ) : (
        <div role="list" className="space-y-6">
          {dayGroups.map((group) => (
            <div key={`${group.label}-${group.date}`}>
              <p className="label-overline mb-2">{dayGroupTitle(group.label, group.date, t, locale)}</p>
              <div className="rounded-lg border border-border divide-y divide-border">
                {group.items.map((notification) => (
                  <NotificationListItem
                    key={notification.id}
                    notification={notification}
                    variant="list"
                    selected={selected.has(notification.id)}
                    onSelectChange={(isSelected) => toggleSelected(notification.id, isSelected)}
                    linkContext={linkContext}
                    onOpen={openNotification}
                    onMarkRead={(id) => markRead.mutate(id)}
                    onMarkUnread={(id) => markUnread.mutate(id)}
                    onArchive={(id) => archive.mutate(id)}
                    onUnarchive={(id) => unarchive.mutate(id)}
                    onDelete={(id) => remove.mutate(id)}
                  />
                ))}
              </div>
            </div>
          ))}

          {hasNextPage && (
            <div className="flex justify-center">
              <Button variant="outline" size="sm" disabled={isFetchingNextPage} onClick={() => fetchNextPage()}>
                {isFetchingNextPage ? '…' : t('loadMore')}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

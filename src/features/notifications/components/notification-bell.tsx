'use client';

import { Bell } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useMarkRead, useNotifications } from '../api/use-notifications';
import { getNotificationEntry } from '../lib/notification-registry';
import type { Notification } from '../types';

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  return `${Math.floor(diffH / 24)}d ago`;
}

function resolveContent(
  notification: Notification,
  t: ReturnType<typeof useTranslations<'Notifications'>>,
): { title: string; body: string } {
  const entry = getNotificationEntry(notification.type);
  return {
    title: entry.resolveTitle(notification.templateData, t),
    body: entry.resolveBody(notification.templateData, t),
  };
}

function NotificationItem({
  notification,
  t,
  onMarkRead,
}: {
  notification: Notification;
  t: ReturnType<typeof useTranslations<'Notifications'>>;
  onMarkRead: (id: string) => void;
}) {
  const { title, body } = resolveContent(notification, t);

  return (
    <DropdownMenuItem
      className="flex flex-col items-start gap-0.5 px-3 py-2.5"
      onSelect={() => {
        if (!notification.isRead) onMarkRead(notification.id);
      }}
    >
      <div className="flex w-full items-start gap-2">
        {!notification.isRead && (
          <span
            aria-label={t('unreadDot')}
            className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary"
          />
        )}
        <div className={!notification.isRead ? '' : 'pl-4'}>
          <p className="text-sm font-medium leading-tight">{title}</p>
          <p className="mt-0.5 text-xs text-muted-foreground leading-snug">{body}</p>
          <p className="mt-1 text-[11px] text-muted-foreground/70">
            {timeAgo(notification.createdAt)}
          </p>
        </div>
      </div>
    </DropdownMenuItem>
  );
}

export function NotificationBell() {
  const t = useTranslations('Notifications');
  const { data } = useNotifications();
  const { mutate: markRead } = useMarkRead();

  const notifications = data?.items ?? [];
  const unreadCount = data?.unreadCount ?? 0;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t('label', { count: unreadCount })}
          className="relative"
        >
          <Bell className="size-5" />
          {unreadCount > 0 && (
            <span
              aria-hidden="true"
              className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-medium text-destructive-foreground"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>{t('title')}</span>
          {unreadCount > 0 && (
            <span className="text-xs font-normal text-muted-foreground">
              {t('unread', { count: unreadCount })}
            </span>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {notifications.length === 0 ? (
          <div className="px-3 py-6 text-center text-sm text-muted-foreground">
            {t('empty')}
          </div>
        ) : (
          <DropdownMenuGroup>
            {notifications.map((n) => (
              <NotificationItem
                key={n.id}
                notification={n}
                t={t}
                onMarkRead={markRead}
              />
            ))}
          </DropdownMenuGroup>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

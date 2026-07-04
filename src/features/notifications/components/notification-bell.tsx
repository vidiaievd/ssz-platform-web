'use client';

import { useState } from 'react';
import { Bell } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useArchive, useMarkAllRead, useMarkRead, useNotifications } from '../api/use-notifications';
import type { NotificationLinkContext } from '../lib/notification-registry';
import type { Notification } from '../types';
import { LiveIndicator } from './live-indicator';
import { NotificationListItem } from './notification-list-item';

const BELL_PREVIEW_LIMIT = 8;

export interface NotificationBellProps {
  linkContext: NotificationLinkContext;
  notificationsHref?: string;
}

function noop() {}

export function NotificationBell({ linkContext, notificationsHref }: NotificationBellProps) {
  const t = useTranslations('Notifications');
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { data, isError } = useNotifications();
  const { mutate: markRead } = useMarkRead();
  const { mutate: markAllRead } = useMarkAllRead();
  const { mutate: archive } = useArchive();

  const notifications = data?.items.slice(0, BELL_PREVIEW_LIMIT) ?? [];
  const unreadCount = data?.unreadCount ?? 0;

  function openNotification(notification: Notification, href: string | undefined) {
    setOpen(false);
    if (href) router.push(href);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
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
      </PopoverTrigger>
      <PopoverContent align="end" className="w-95 p-0">
        <div className="flex items-center justify-between px-3 pt-3 pb-2">
          <span className="text-sm font-semibold">{t('title')}</span>
          <LiveIndicator connected={!isError} />
        </div>

        {notifications.length === 0 ? (
          <div className="px-3 py-6 text-center text-sm text-muted-foreground">{t('empty')}</div>
        ) : (
          <ScrollArea className="max-h-96">
            <div role="list" className="px-1.5 pb-1.5">
              {notifications.map((notification) => (
                <NotificationListItem
                  key={notification.id}
                  notification={notification}
                  variant="dropdown"
                  linkContext={linkContext}
                  onOpen={openNotification}
                  onMarkRead={markRead}
                  onMarkUnread={noop}
                  onArchive={archive}
                  onUnarchive={noop}
                  onDelete={noop}
                />
              ))}
            </div>
          </ScrollArea>
        )}

        <div className="flex items-center justify-between gap-2 border-t border-border px-3 py-2">
          <Button
            variant="ghost"
            size="sm"
            disabled={unreadCount === 0}
            onClick={() => markAllRead()}
          >
            {t('markAllAsRead')}
          </Button>
          {notificationsHref && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setOpen(false);
                router.push(notificationsHref);
              }}
            >
              {t('openAll')}
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

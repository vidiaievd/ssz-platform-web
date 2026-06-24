'use client';

import { useTranslations } from 'next-intl';
import {
  Archive,
  ArchiveRestore,
  Check,
  EyeOff,
  MoreHorizontal,
  Trash2,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  getNotificationEntry,
  type NotificationLinkContext,
} from '../lib/notification-registry';
import type { Notification } from '../types';

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return 'now';
  if (diffMin < 60) return `${diffMin}m`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h`;
  return `${Math.floor(diffH / 24)}d`;
}

export interface NotificationListItemProps {
  notification: Notification;
  variant: 'list' | 'dropdown';
  selected?: boolean;
  onSelectChange?: (selected: boolean) => void;
  linkContext: NotificationLinkContext;
  onOpen: (notification: Notification, href: string | undefined) => void;
  onMarkRead: (id: string) => void;
  onMarkUnread: (id: string) => void;
  onArchive: (id: string) => void;
  onUnarchive: (id: string) => void;
  onDelete: (id: string) => void;
  actionsSlot?: React.ReactNode;
}

export function NotificationListItem({
  notification,
  variant,
  selected = false,
  onSelectChange,
  linkContext,
  onOpen,
  onMarkRead,
  onMarkUnread,
  onArchive,
  onUnarchive,
  onDelete,
  actionsSlot,
}: NotificationListItemProps) {
  const t = useTranslations('Notifications');
  const entry = getNotificationEntry(notification.type);
  const Icon = entry.icon;
  const title = entry.resolveTitle(notification.templateData, t);
  const body = entry.resolveBody(notification.templateData, t);
  const href = entry.getLink(notification.templateData, linkContext);
  const isArchived = Boolean(notification.archivedAt);

  return (
    <div
      role="article"
      aria-label={title}
      className={cn(
        'group flex items-start gap-3 px-3 py-3 rounded-lg transition-colors',
        variant === 'list' && 'border-b border-border last:border-b-0',
        !notification.isRead && 'bg-primary/5',
        entry.priority === 'high' && !isArchived && 'border-l-2 border-l-amber-500',
      )}
    >
      {variant === 'list' && (
        <Checkbox
          aria-label={t('selectAll')}
          checked={selected}
          onCheckedChange={(checked) => onSelectChange?.(checked === true)}
          className="mt-1 opacity-0 group-hover:opacity-100 data-[state=checked]:opacity-100 focus-visible:opacity-100"
        />
      )}

      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />

      <button
        type="button"
        className="flex-1 text-left"
        onClick={() => {
          if (!notification.isRead && !entry.actionable) onMarkRead(notification.id);
          onOpen(notification, href);
        }}
      >
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium leading-tight">{title}</p>
          {entry.actionable && !isArchived && (
            <Badge variant="warning" className="text-[10px]">
              {t('actions.needsAction')}
            </Badge>
          )}
        </div>
        {body && <p className="mt-0.5 text-xs text-muted-foreground leading-snug">{body}</p>}
        <time
          dateTime={notification.createdAt}
          title={new Date(notification.createdAt).toLocaleString()}
          className="mt-1 block text-[11px] text-muted-foreground/70"
        >
          {timeAgo(notification.createdAt)}
        </time>
      </button>

      <div className="flex items-center gap-1.5 shrink-0">
        {!notification.isRead && (
          <span aria-label={t('unreadDot')} className="size-2 rounded-full bg-primary" />
        )}
        {actionsSlot}
        {variant === 'list' && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                aria-label={t('rowActions.markRead')}
              >
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {notification.isRead ? (
                <DropdownMenuItem onSelect={() => onMarkUnread(notification.id)}>
                  <EyeOff className="size-4" />
                  {t('rowActions.markUnread')}
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onSelect={() => onMarkRead(notification.id)}>
                  <Check className="size-4" />
                  {t('rowActions.markRead')}
                </DropdownMenuItem>
              )}
              {isArchived ? (
                <DropdownMenuItem onSelect={() => onUnarchive(notification.id)}>
                  <ArchiveRestore className="size-4" />
                  {t('rowActions.unarchive')}
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onSelect={() => onArchive(notification.id)}>
                  <Archive className="size-4" />
                  {t('rowActions.archive')}
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                variant="destructive"
                onSelect={() => onDelete(notification.id)}
              >
                <Trash2 className="size-4" />
                {t('rowActions.delete')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  );
}

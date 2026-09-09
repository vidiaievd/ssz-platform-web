'use client';

import { Lock } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { cn } from '@/lib/utils';
import { Link, usePathname } from '@/lib/i18n/navigation';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { NavItem } from './types';

type SidebarItemProps = NavItem & { collapsed: boolean };

function isActive(pathname: string | null, href: string, match?: NavItem['match']): boolean {
  if (!pathname) return false;
  if (match) return match(pathname);
  return pathname === href || pathname.startsWith(href + '/');
}

export function SidebarItem({
  href,
  icon: Icon,
  labelKey,
  match,
  collapsed,
  disabled,
  lockReason,
  badge,
  badgeAlert,
}: SidebarItemProps) {
  const t = useTranslations('Nav');
  const pathname = usePathname();
  const active = isActive(pathname, href, match);
  const label = t(labelKey as Parameters<typeof t>[0]);
  const hasBadge = typeof badge === 'number' && badge > 0;
  const alerting = hasBadge && badgeAlert === true;

  if (disabled) {
    const content = (
      <span
        aria-disabled="true"
        className={cn(
          'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium',
          'opacity-40 cursor-not-allowed select-none',
          collapsed && 'justify-center px-2',
        )}
      >
        <Icon className="size-5 shrink-0" aria-hidden="true" />
        {!collapsed && <span className="truncate flex-1">{label}</span>}
        {!collapsed && <Lock className="size-3.5 shrink-0 ml-auto" aria-hidden="true" />}
      </span>
    );

    if (collapsed || lockReason) {
      // In collapsed mode show the label; in expanded mode show a generic lock reason.
      // Full i18n for lockReason added in Phase 7.
      const tooltipText = collapsed ? label : 'Access restricted';
      return (
        <Tooltip>
          <TooltipTrigger asChild>{content}</TooltipTrigger>
          <TooltipContent side="right">{tooltipText}</TooltipContent>
        </Tooltip>
      );
    }

    return content;
  }

  const link = (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      aria-label={collapsed ? label : undefined}
      className={cn(
        'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        'hover:bg-primary/10 hover:text-primary',
        active ? 'bg-primary/10 text-primary' : 'text-(--ssz-text-secondary)',
        collapsed && 'justify-center px-2',
      )}
    >
      <span className="relative shrink-0">
        <Icon className="size-5" aria-hidden="true" />
        {hasBadge && collapsed && (
          <span
            className={cn(
              'absolute -right-1 -top-1 size-2 rounded-full',
              alerting ? 'bg-warning-500' : 'bg-secondary-500',
            )}
            aria-hidden="true"
          />
        )}
      </span>
      {!collapsed && <span className="truncate flex-1">{label}</span>}
      {!collapsed && hasBadge && (
        <span
          // The dot carries meaning no screen reader can see, so the pill says in words
          // what the colour says in the margin.
          aria-label={t(alerting ? 'badgeCountOverdue' : 'badgeCount', { count: badge })}
          className="ml-auto inline-flex min-w-5 items-center justify-center gap-1 rounded-full bg-secondary-500 px-1.5 py-0.5 text-[11px] font-bold leading-none text-white"
        >
          {badge}
          {alerting && <span className="size-1.5 rounded-full bg-warning-300" aria-hidden="true" />}
        </span>
      )}
    </Link>
  );

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{link}</TooltipTrigger>
        <TooltipContent side="right">{label}</TooltipContent>
      </Tooltip>
    );
  }

  return link;
}

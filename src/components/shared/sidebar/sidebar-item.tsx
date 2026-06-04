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
}: SidebarItemProps) {
  const t = useTranslations('Nav');
  const pathname = usePathname();
  const active = isActive(pathname, href, match);
  const label = t(labelKey as Parameters<typeof t>[0]);

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
          <TooltipTrigger asChild>
            {content}
          </TooltipTrigger>
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
      className={cn(
        'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        'hover:bg-primary/10 hover:text-primary',
        active
          ? 'bg-primary/10 text-primary'
          : 'text-(--ssz-text-secondary)',
        collapsed && 'justify-center px-2',
      )}
    >
      <Icon className="size-5 shrink-0" aria-hidden="true" />
      {!collapsed && <span className="truncate">{label}</span>}
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

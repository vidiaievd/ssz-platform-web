'use client';

import { useTranslations } from 'next-intl';

import { cn } from '@/lib/utils';
import { SidebarItem } from './sidebar-item';
import type { NavSection } from './types';

type SidebarSectionProps = NavSection & {
  collapsed: boolean;
  className?: string;
};

export function SidebarSection({ titleKey, items, collapsed, className }: SidebarSectionProps) {
  const t = useTranslations('Nav');

  return (
    <div className={cn('flex flex-col gap-0.5', className)}>
      {titleKey && !collapsed && (
        <p className="mb-1 px-3 text-xs font-semibold uppercase tracking-wider text-(--ssz-text-muted)">
          {t(titleKey as Parameters<typeof t>[0])}
        </p>
      )}
      {items.map((item) => (
        <SidebarItem key={item.href} {...item} collapsed={collapsed} />
      ))}
    </div>
  );
}

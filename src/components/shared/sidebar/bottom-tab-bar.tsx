'use client';

import { useTranslations } from 'next-intl';

import { cn } from '@/lib/utils';
import { Link, usePathname } from '@/lib/i18n/navigation';
import type { NavItem } from './types';

type BottomTabBarProps = {
  items: NavItem[];
};

function isActive(pathname: string | null, href: string, match?: NavItem['match']): boolean {
  if (!pathname) return false;
  if (match) return match(pathname);
  return pathname === href || pathname.startsWith(href + '/');
}

/** Mobile-only bottom tab bar. Student surface uses this instead of the drawer for primary nav. */
export function BottomTabBar({ items }: BottomTabBarProps) {
  const t = useTranslations('Nav');
  const pathname = usePathname();

  return (
    <nav
      className="md:hidden fixed inset-x-0 bottom-0 z-40 flex items-stretch border-t border-border bg-card"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {items.map(({ href, icon: Icon, labelKey, match, badge }) => {
        const active = isActive(pathname, href, match);
        const hasBadge = typeof badge === 'number' && badge > 0;
        const label = t(labelKey as Parameters<typeof t>[0]);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
              active ? 'text-primary' : 'text-(--ssz-text-secondary)',
            )}
          >
            <span className="relative">
              <Icon className="size-5" aria-hidden="true" />
              {hasBadge && (
                <span
                  className="absolute -right-1.5 -top-1.5 min-w-3.5 rounded-full bg-secondary-500 px-0.5 text-center text-[9px] font-bold leading-3.5 text-white"
                  aria-hidden="true"
                >
                  {badge}
                </span>
              )}
            </span>
            <span className="truncate">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

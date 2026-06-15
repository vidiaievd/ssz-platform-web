'use client';

import { Bell, ShieldCheck, UserRound } from 'lucide-react';

import { usePathname, useRouter } from '@/lib/i18n/navigation';
import { Link } from '@/lib/i18n/navigation';
import { cn } from '@/lib/utils';
import { useUnsavedChanges } from '@/hooks/use-unsaved-changes';

const ICON_MAP = {
  UserRound,
  ShieldCheck,
  Bell,
} as const;

export type SettingsNavIconName = keyof typeof ICON_MAP;

export type SettingsNavItem = {
  href: string;
  label: string;
  icon?: SettingsNavIconName;
  badge?: React.ReactNode;
};

type SettingsLayoutProps = {
  nav: SettingsNavItem[];
  children: React.ReactNode;
};

export function SettingsLayout({ nav, children }: SettingsLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const unsavedChanges = useUnsavedChanges();

  return (
    <div className="h-full flex flex-col md:flex-row">
      <aside className="md:w-56 shrink-0 border-b md:border-b-0 md:border-r border-border md:overflow-y-auto">
        <nav aria-label="Settings navigation" className="flex md:flex-col gap-1 p-3">
          {nav.map((item) => {
            const active = pathname.endsWith(item.href) || pathname.includes(item.href + '/');
            const Icon = item.icon ? ICON_MAP[item.icon] : undefined;
            return (
              <Link
                key={item.href}
                href={item.href as Parameters<typeof Link>[0]['href']}
                className={cn(
                  'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  active
                    ? 'border-l-2 border-primary bg-accent text-accent-foreground pl-2.5'
                    : 'text-(--ssz-text-muted) hover:bg-accent/60 hover:text-accent-foreground',
                )}
                aria-current={active ? 'page' : undefined}
                onClick={(e) => {
                  if (!unsavedChanges?.isDirty) return;
                  e.preventDefault();
                  unsavedChanges.guard(() =>
                    router.push(item.href as Parameters<typeof router.push>[0]),
                  );
                }}
              >
                {Icon && (
                  <Icon
                    className={cn('size-4 shrink-0', active && 'text-primary')}
                    aria-hidden
                  />
                )}
                <span className="flex-1 min-w-0 truncate">{item.label}</span>
                {item.badge}
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="flex-1 min-w-0 min-h-0 overflow-y-auto">{children}</div>
    </div>
  );
}

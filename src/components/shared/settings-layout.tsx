'use client';

import { usePathname } from '@/lib/i18n/navigation';
import { Link } from '@/lib/i18n/navigation';
import { cn } from '@/lib/utils';

type SettingsNavItem = {
  href: string;
  label: string;
};

type SettingsLayoutProps = {
  nav: SettingsNavItem[];
  children: React.ReactNode;
};

export function SettingsLayout({ nav, children }: SettingsLayoutProps) {
  const pathname = usePathname();

  return (
    <div className="flex flex-col md:flex-row min-h-full">
      <aside className="md:w-52 shrink-0 border-b md:border-b-0 md:border-r border-border">
        <nav aria-label="Settings navigation" className="flex md:flex-col gap-1 p-3">
          {nav.map((item) => {
            const active = pathname.endsWith(item.href) || pathname.includes(item.href + '/');
            return (
              <Link
                key={item.href}
                href={item.href as Parameters<typeof Link>[0]['href']}
                className={cn(
                  'rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  active
                    ? 'bg-accent text-accent-foreground'
                    : 'text-[var(--ssz-text-muted)] hover:bg-accent/60 hover:text-accent-foreground',
                )}
                aria-current={active ? 'page' : undefined}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

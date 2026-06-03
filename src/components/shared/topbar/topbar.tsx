'use client';

import { Menu } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { LanguageSwitcher } from '@/components/shared/language-switcher';
import { ThemeToggle } from '@/components/shared/theme-toggle';
import { UserMenu } from './user-menu';
import type { CurrentUser } from '@/features/auth/types/current-user';

type TopbarProps = {
  user: CurrentUser;
  onMenuOpen: () => void;
  /** Slot rendered after the mobile menu button — used for SchoolSwitcher. */
  leading?: React.ReactNode;
  breadcrumbs?: React.ReactNode;
  actions?: React.ReactNode;
};

export function Topbar({ user, onMenuOpen, leading, breadcrumbs, actions }: TopbarProps) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-card px-4">
      <Button
        variant="ghost"
        size="icon"
        aria-label="Open navigation"
        className="md:hidden"
        onClick={onMenuOpen}
      >
        <Menu className="size-5" />
      </Button>

      {leading}

      <div className="flex-1 min-w-0">
        {breadcrumbs}
      </div>

      <div className="flex items-center gap-1 ml-auto">
        {actions}
        <LanguageSwitcher />
        <ThemeToggle />
        <UserMenu user={user} />
      </div>
    </header>
  );
}

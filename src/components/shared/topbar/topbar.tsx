'use client';

import { Menu } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { UserMenu } from './user-menu';
import type { CurrentUser } from '@/features/auth/types/current-user';

type TopbarProps = {
  user: CurrentUser;
  onMenuOpen: () => void;
  /** Left cluster: workspace switcher (+ role badge in school variant) */
  leading?: React.ReactNode;
  /** Right cluster: trial pill, scheduling alerts, notification bell */
  actions?: React.ReactNode;
  activeContextKey?: string;
};

export function Topbar({ user, onMenuOpen, leading, actions, activeContextKey }: TopbarProps) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border bg-card px-4">
      {/* Mobile hamburger */}
      <Button
        variant="ghost"
        size="icon"
        aria-label="Open navigation"
        className="md:hidden shrink-0"
        onClick={onMenuOpen}
      >
        <Menu className="size-5" />
      </Button>

      {/* Left: workspace switcher */}
      {leading}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Right: utility cluster */}
      <div className="flex items-center gap-2 shrink-0">
        {actions}
        <UserMenu user={user} activeContextKey={activeContextKey} />
      </div>
    </header>
  );
}

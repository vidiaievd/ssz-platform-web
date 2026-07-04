import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

export interface BottomBarProps {
  children: ReactNode;
  className?: string;
}

export function BottomBar({ children, className }: BottomBarProps) {
  return (
    <div
      className={cn(
        'fixed inset-x-0 bottom-0 z-20 flex justify-center gap-3 px-6 py-3.5',
        'border-t border-[var(--ssz-border-default)] bg-[var(--ssz-bg-surface)]/90',
        'backdrop-blur-sm',
        className,
      )}
    >
      {children}
    </div>
  );
}

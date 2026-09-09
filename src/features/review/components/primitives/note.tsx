'use client';

import type { ReactNode } from 'react';
import { AlertTriangle, Info, Lock, TriangleAlert } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

export type NoteTone = 'info' | 'warn' | 'error' | 'muted';

const TONE: Record<NoteTone, { wrap: string; icon: string; title: string; fallback: LucideIcon }> =
  {
    info: {
      wrap: 'border-info-300 bg-info-50 dark:bg-info-500/10',
      icon: 'text-info-700 dark:text-info-300',
      title: 'text-info-700 dark:text-info-300',
      fallback: Info,
    },
    warn: {
      wrap: 'border-warning-300 bg-warning-50 dark:bg-warning-500/10',
      icon: 'text-warning-700 dark:text-warning-300',
      title: 'text-warning-700 dark:text-warning-300',
      fallback: TriangleAlert,
    },
    error: {
      wrap: 'border-error-300 bg-error-50 dark:bg-error-500/10',
      icon: 'text-error-700 dark:text-error-300',
      title: 'text-error-700 dark:text-error-300',
      fallback: AlertTriangle,
    },
    muted: {
      wrap: 'border-border bg-(--ssz-bg-subtle)',
      icon: 'text-muted-foreground',
      title: 'text-foreground',
      fallback: Lock,
    },
  };

export interface NoteProps {
  tone?: NoteTone;
  icon?: LucideIcon;
  title?: string;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
  /**
   * `status` for the ones already on screen when it loads, `alert` for the one that
   * arrives in answer to something the reviewer just did — a colleague's verdict landing
   * on the submission they were deciding has to interrupt, because it changes what the
   * buttons under it now do.
   */
  role?: 'status' | 'alert';
}

/**
 * Something the reviewer needs to know before they decide, said in place.
 *
 * Every edge state of the review screen is one of these rather than a dialog: a colleague
 * already here, a marker run out, a breakdown that could not be built. None of them stops
 * the work, and a modal that had to be dismissed before the submission could be read would
 * make the ordinary case — two teachers on one group — feel like a failure.
 *
 * `role="status"` by default and not `alert`: these appear as the screen loads, and a
 * live region that interrupted the reader on arrival would announce them ahead of the
 * work itself. The one that arrives mid-decision asks for `alert` explicitly.
 */
export function Note({
  tone = 'info',
  icon,
  title,
  children,
  action,
  className,
  role = 'status',
}: NoteProps) {
  const style = TONE[tone];
  const Icon = icon ?? style.fallback;

  return (
    <div
      role={role}
      className={cn(
        'flex items-start gap-[11px] rounded-[11px] border-[1.5px] px-3.5 py-3',
        style.wrap,
        className,
      )}
    >
      <Icon aria-hidden className={cn('mt-px h-[17px] w-[17px] shrink-0', style.icon)} />
      <div className="min-w-0 flex-1">
        {title === undefined ? null : (
          <p className={cn('text-[13.5px] font-bold', style.title)}>{title}</p>
        )}
        {children === undefined ? null : (
          <div className="text-[13px] leading-relaxed text-muted-foreground">{children}</div>
        )}
      </div>
      {action}
    </div>
  );
}

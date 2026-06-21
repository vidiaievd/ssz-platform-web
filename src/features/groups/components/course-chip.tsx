'use client';

import { useState } from 'react';

import { cn } from '@/lib/utils';
import { CoursePanel } from './course-panel';
import type { CourseView } from '../types';

type Props = {
  courseView: CourseView;
  /** 'fact' renders as a labelled header/overview fact; 'link' renders as a footer "View course →" link. */
  variant?: 'fact' | 'link';
  className?: string;
};

// Each call site owns its own open state + CoursePanel instance (header fact row
// and Overview Course card both render a CourseChip) — lighter than lifting shared
// dialog state across the two, since the panel itself is stateless and cheap to mount twice.
export function CourseChip({ courseView, variant = 'fact', className }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        className={cn(
          variant === 'fact'
            ? 'inline-flex items-baseline gap-1 hover:underline underline-offset-2'
            : 'text-xs font-semibold text-primary-600 dark:text-primary-400 hover:underline',
          className,
        )}
      >
        {variant === 'fact' ? (
          <>
            <span className="text-(--ssz-text-muted)">Course</span>
            <span className="font-medium text-(--ssz-text-secondary)">
              {courseView.courseName ?? 'No course assigned'}
            </span>
          </>
        ) : (
          'View course →'
        )}
      </button>
      <CoursePanel courseView={courseView} open={open} onOpenChange={setOpen} />
    </>
  );
}

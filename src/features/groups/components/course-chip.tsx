'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

import { cn } from '@/lib/utils';
import { CoursePanel } from './course-panel';
import type { CourseView } from '../types';

type Props = {
  courseView: CourseView;
  canManage: boolean;
  /** 'fact' renders as a labelled header/overview fact; 'link' renders as a footer "View course →" link. */
  variant?: 'fact' | 'link';
  className?: string;
};

// Each call site owns its own open state + CoursePanel instance (header fact row
// and Overview Course card both render a CourseChip) — lighter than lifting shared
// dialog state across the two, since the panel itself is stateless and cheap to mount twice.
export function CourseChip({ courseView, canManage, variant = 'fact', className }: Props) {
  const t = useTranslations('Groups');
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        className={cn(
          'py-2.5 -my-2.5 md:py-0 md:my-0',
          variant === 'fact'
            ? 'inline-flex items-center gap-1 hover:underline underline-offset-2'
            : 'text-xs font-semibold text-primary-600 dark:text-primary-400 hover:underline',
          className,
        )}
      >
        {variant === 'fact' ? (
          <>
            <span className="text-(--ssz-text-muted)">{t('course.title')}</span>
            <span className="font-medium text-(--ssz-text-secondary)">
              {courseView.courseName ?? t('course.noCourse')}
            </span>
          </>
        ) : (
          t('course.open')
        )}
      </button>
      <CoursePanel courseView={courseView} canManage={canManage} open={open} onOpenChange={setOpen} />
    </>
  );
}

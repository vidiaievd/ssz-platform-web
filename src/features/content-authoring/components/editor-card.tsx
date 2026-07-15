import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

interface EditorCardProps {
  title?: string;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
}

/** Reusable per-type editor sub-card (design_handoff_course_management/coursemgmt/LessonEditor.jsx `EdCard`). */
export function EditorCard({ title, right, children, className }: EditorCardProps) {
  return (
    <div className={cn('rounded-2xl border border-border bg-surface p-4.5', className)}>
      {title && (
        <div className="mb-3.5 flex items-center justify-between gap-2">
          <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
            {title}
          </span>
          {right}
        </div>
      )}
      {children}
    </div>
  );
}

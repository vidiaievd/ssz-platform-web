'use client';

import { useRef, useState } from 'react';

import { cn } from '@/lib/utils';

interface InlineRenameProps {
  value: string;
  /** Rendered when not editing — the row's own title element, keeping its type styles. */
  children: React.ReactNode;
  editing: boolean;
  onCommit: (title: string) => void;
  onCancel: () => void;
  className?: string;
}

/**
 * Swaps a title for an input in place (F2, or double-click).
 *
 * Blur commits rather than cancels: an author who types a name and clicks away
 * means to keep it, and losing the edit to a stray click is the more expensive
 * mistake. Escape is the explicit way out.
 */
export function InlineRename({
  value,
  children,
  editing,
  onCommit,
  onCancel,
  className,
}: InlineRenameProps) {
  // The input only exists while editing, so mounting it seeds the draft from the
  // current title — no effect needed to keep the two in step.
  const [draft, setDraft] = useState(value);
  // Guards against blur firing after Enter or Escape already resolved the edit.
  const settled = useRef(false);

  if (!editing) return <>{children}</>;

  function settle(commit: boolean) {
    if (settled.current) return;
    settled.current = true;
    const trimmed = draft.trim();
    if (commit && trimmed && trimmed !== value) onCommit(trimmed);
    else onCancel();
  }

  return (
    <input
      // The author asked for this field by pressing F2 or double-clicking, so
      // focusing it is the point rather than a hijack.
      autoFocus
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onFocus={(e) => e.currentTarget.select()}
      onClick={(e) => e.stopPropagation()}
      onBlur={() => settle(true)}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === 'Enter') settle(true);
        if (e.key === 'Escape') settle(false);
      }}
      className={cn(
        'min-w-55 rounded-xs border border-(--ssz-border-focus) bg-surface px-1.5 py-0.5 text-sm',
        'shadow-[var(--ssz-focus-ring)] focus:outline-none',
        className,
      )}
    />
  );
}

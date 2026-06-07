import { cn } from '@/lib/utils';
import type { StudentStatus } from '@/features/students/types';

export type StatusMeta = {
  label: string;
  glyph: string;
  className: string;
};

export const STATUS_META: Record<StudentStatus, StatusMeta> = {
  active: {
    label: 'Active',
    glyph: '●',
    className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  },
  'at-risk': {
    label: 'At risk',
    glyph: '▲',
    className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  },
  new: {
    label: 'New',
    glyph: '✦',
    className: 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300',
  },
  finished: {
    label: 'Finished',
    glyph: '✓',
    className: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400',
  },
  clash: {
    label: 'Clash',
    glyph: '⚠',
    className: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  },
  unassigned: {
    label: 'No group',
    glyph: '⊘',
    className: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  },
};

type Props = {
  status: StudentStatus;
  className?: string;
};

export function StatusChip({ status, className }: Props) {
  const meta = STATUS_META[status];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium',
        meta.className,
        className,
      )}
    >
      <span aria-hidden="true">{meta.glyph}</span>
      <span>{meta.label}</span>
    </span>
  );
}

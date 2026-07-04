'use client';

import { useState } from 'react';

import { Calendar, ChevronRight, ClipboardList, Pencil } from 'lucide-react';
import { useTranslations } from 'next-intl';

import type { Assignment } from '@/features/learning/types';

import { AssignmentStatusBadge } from './assignment-status-badge';

interface AssignmentRowProps {
  assignment: Assignment;
  onOpen: (a: Assignment) => void;
}

/* Moderate overdue chrome (the recommended default) */
const OVERDUE_BG     = 'oklch(0.985 0.014 15)';
const OVERDUE_BORDER = '1.5px solid oklch(0.86 0.07 15)';
const OVERDUE_BAR    = 'oklch(0.60 0.125 15)';
const OVERDUE_TEXT   = 'oklch(0.50 0.13 15)';

export function AssignmentRow({ assignment: a, onOpen }: AssignmentRowProps) {
  const [hovered, setHovered] = useState(false);
  const t = useTranslations('Assignments');
  const isOverdue = a.status === 'overdue';
  const ModeIcon = a.mode === 'graded' ? ClipboardList : Pencil;

  const rowStyle: React.CSSProperties = {
    background:   isOverdue ? OVERDUE_BG : 'var(--ssz-bg-surface)',
    border:       isOverdue
      ? OVERDUE_BORDER
      : `1.5px solid ${hovered ? 'var(--ssz-color-primary-500)' : 'var(--ssz-border-default)'}`,
    boxShadow: hovered ? 'var(--ssz-shadow-md)' : 'var(--ssz-shadow-xs)',
    transition: 'box-shadow 160ms cubic-bezier(0.16,1,0.3,1), border-color 160ms cubic-bezier(0.16,1,0.3,1)',
  };

  const iconBg = isOverdue
    ? 'oklch(0.95 0.05 15)'
    : a.status === 'completed'
      ? 'var(--ssz-color-success-100)'
      : a.status === 'submitted' || a.status === 'in-review'
        ? 'var(--ssz-color-info-100)'
        : a.status === 'returned'
          ? 'oklch(0.95 0.04 82)'
          : 'var(--ssz-color-primary-100)';

  const iconColor = isOverdue
    ? OVERDUE_BAR
    : a.status === 'completed'
      ? 'var(--ssz-color-success-500)'
      : a.status === 'submitted' || a.status === 'in-review'
        ? 'var(--ssz-color-info-500)'
        : a.status === 'returned'
          ? 'oklch(0.57 0.105 82)'
          : 'var(--ssz-color-primary-500)';

  return (
    <button
      type="button"
      onClick={() => onOpen(a)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="flex w-full items-center gap-3.5 rounded-xl px-4 py-[15px] text-left relative overflow-hidden"
      style={rowStyle}
      aria-label={a.title}
    >
      {/* Overdue accent bar */}
      {isOverdue && (
        <span
          aria-hidden
          className="absolute left-0 top-0 bottom-0 rounded-l-xl"
          style={{ width: 4, background: OVERDUE_BAR }}
        />
      )}

      {/* Mode icon */}
      <span
        className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[11px]"
        style={{ background: iconBg }}
        aria-hidden
      >
        <ModeIcon size={19} style={{ color: iconColor }} />
      </span>

      {/* Content */}
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span
            className="truncate text-[14.5px] font-semibold"
            style={{ color: 'var(--ssz-text-primary)' }}
          >
            {a.title}
          </span>
        </span>
        <span
          className="mt-1 flex flex-wrap items-center gap-2.5 text-[11.5px]"
          style={{ color: 'var(--ssz-text-muted)' }}
        >
          <span className="flex items-center gap-1">
            <ModeIcon size={12} aria-hidden />
            {t(a.mode === 'graded' ? 'mode.graded' : 'mode.written')}
          </span>
          <span aria-hidden style={{ color: 'var(--ssz-border-strong)' }}>·</span>
          <span>{a.skill}</span>
          <span aria-hidden style={{ color: 'var(--ssz-border-strong)' }}>·</span>
          <span>{a.teacher}</span>
        </span>
      </span>

      {/* Right: status + due */}
      <span className="flex shrink-0 flex-col items-end gap-1.5">
        <AssignmentStatusBadge status={a.status} />
        <span
          className="flex items-center gap-1 text-xs"
          style={{
            color:      isOverdue ? OVERDUE_TEXT : 'var(--ssz-text-secondary)',
            fontWeight: isOverdue ? 700 : 500,
          }}
        >
          {a.status === 'completed' ? (
            <span>{a.score}%</span>
          ) : (
            <>
              <Calendar size={12} aria-hidden style={{ color: isOverdue ? OVERDUE_TEXT : 'var(--ssz-text-muted)' }} />
              {isOverdue ? `${a.overdueDays}d overdue` : a.dueRel}
            </>
          )}
        </span>
      </span>

      <ChevronRight size={18} aria-hidden style={{ color: 'var(--ssz-text-muted)', flexShrink: 0 }} />
    </button>
  );
}

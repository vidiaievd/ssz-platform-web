'use client';

import type { ReactNode } from 'react';
import { AlertTriangle, Info, Wand, type LucideIcon } from 'lucide-react';

/**
 * The few layout pieces the four steps share — the prototype's `wb-card`, `Field`,
 * `Callout`, `EmptyState` and `wb-bar` (plan 67 §7). Not the prototype's DOM: its *values*,
 * carried as tokens, around the project's own inputs and buttons.
 */

/** Eyebrow «Step N of 4», heading and lede (§7.2). */
export function StepHead({
  eyebrow,
  title,
  lede,
}: {
  eyebrow: string;
  title: string;
  lede?: ReactNode;
}) {
  return (
    <div>
      <p className="m-0 text-[11px] font-bold uppercase tracking-[0.08em] text-(--ssz-color-primary-600)">
        {eyebrow}
      </p>
      <h2 className="m-0 mt-1 text-2xl font-bold tracking-tight">{title}</h2>
      {lede !== undefined && (
        <p
          className="m-0 mt-1.5 max-w-[62ch] text-sm text-(--ssz-text-secondary)"
          style={{ textWrap: 'pretty' }}
        >
          {lede}
        </p>
      )}
    </div>
  );
}

export interface CardProps {
  icon?: LucideIcon;
  title?: string;
  /** The muted note on the right of the head. */
  note?: ReactNode;
  /** No padding around the body — the marking canvas sets its own. */
  flush?: boolean;
  foot?: ReactNode;
  children: ReactNode;
  /** Names the card for a screen reader when it has a title. */
  labelledBy?: string;
}

export function Card({
  icon: Icon,
  title,
  note,
  flush = false,
  foot,
  children,
  labelledBy,
}: CardProps) {
  return (
    <section
      {...(labelledBy !== undefined ? { 'aria-labelledby': labelledBy } : {})}
      className="rounded-(--ssz-radius-md) border border-(--ssz-border-default) bg-(--ssz-bg-surface)"
      style={{ boxShadow: 'var(--ssz-shadow-xs)' }}
    >
      {title !== undefined && (
        <div className="flex items-center gap-2 border-b border-(--ssz-border-default) py-2 pr-2 pl-3">
          {Icon !== undefined && <Icon size={15} aria-hidden="true" className="shrink-0" />}
          <h3 id={labelledBy} className="m-0 text-sm font-semibold">
            {title}
          </h3>
          <span className="flex-1" />
          {note !== undefined && <span className="text-xs text-(--ssz-text-muted)">{note}</span>}
        </div>
      )}
      <div className={flush ? undefined : 'flex flex-col gap-3 p-4'}>{children}</div>
      {foot}
    </section>
  );
}

export interface FieldProps {
  label: string;
  /** The control the label names. Absent for a group that names itself (`aria-label`). */
  htmlFor?: string;
  required?: boolean;
  /** Under the control — `hint` muted, `warn` amber, `error` red. */
  message?: { tone: 'hint' | 'warn' | 'error'; text: string; id: string };
  children: ReactNode;
}

const LABEL = 'mb-[5px] block text-xs font-semibold tracking-wide text-(--ssz-text-secondary)';

const MESSAGE_TONE = {
  hint: 'text-(--ssz-text-muted)',
  warn: 'text-(--ssz-color-warning-700)',
  error: 'text-(--ssz-color-error-700)',
} as const;

export function Field({ label, htmlFor, required = false, message, children }: FieldProps) {
  return (
    <div>
      {htmlFor !== undefined ? (
        <label htmlFor={htmlFor} className={LABEL}>
          {label}
          {required && (
            <span aria-hidden="true" className="ml-[3px] text-(--ssz-color-error-500)">
              *
            </span>
          )}
        </label>
      ) : (
        <span aria-hidden="true" className={LABEL}>
          {label}
        </span>
      )}
      {children}
      {message !== undefined && (
        <p
          id={message.id}
          role={message.tone === 'error' ? 'alert' : undefined}
          className={`m-0 mt-[5px] flex items-start gap-[5px] text-xs ${MESSAGE_TONE[message.tone]}`}
        >
          {message.tone === 'hint' ? null : (
            <AlertTriangle size={13} aria-hidden="true" className="mt-px shrink-0" />
          )}
          {message.text}
        </p>
      )}
    </div>
  );
}

const CALLOUT = {
  info: {
    icon: Info,
    style: {
      background: 'var(--ssz-color-info-50)',
      borderColor: 'var(--ssz-color-info-100)',
      color: 'var(--ssz-color-info-700)',
    },
  },
  tip: {
    icon: Wand,
    style: {
      background: 'var(--ssz-color-primary-50)',
      borderColor: 'var(--ssz-color-primary-100)',
      color: 'var(--ssz-color-primary-700)',
    },
  },
  warn: {
    icon: AlertTriangle,
    style: {
      background: 'var(--ssz-color-warning-50)',
      borderColor: 'var(--ssz-color-warning-100)',
      color: 'var(--ssz-color-warning-700)',
    },
  },
} as const;

export function Callout({
  tone = 'info',
  icon,
  children,
}: {
  tone?: keyof typeof CALLOUT;
  /** In place of the tone's own icon — the handoff's `Callout icon=…`. */
  icon?: LucideIcon;
  children: ReactNode;
}) {
  const { icon: toneIcon, style } = CALLOUT[tone];
  const Icon = icon ?? toneIcon;
  return (
    <div
      data-tone={tone}
      className="flex gap-2.5 rounded-(--ssz-radius-sm) border px-[13px] py-[11px] text-sm leading-snug"
      style={style}
    >
      <Icon size={15} aria-hidden="true" className="mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2.5 rounded-(--ssz-radius-md) border border-dashed border-(--ssz-border-strong) bg-(--ssz-bg-surface) px-6 py-12 text-center">
      <Icon size={26} aria-hidden="true" className="text-(--ssz-text-muted)" />
      <h3 className="m-0 text-base font-semibold">{title}</h3>
      <p className="m-0 max-w-[46ch] text-sm text-(--ssz-text-secondary)">{body}</p>
      {action}
    </div>
  );
}

/** A 6px meter. `skew` turns it amber — past the density line (AC-A4). */
export function Bar({
  value,
  skew = false,
  label,
}: {
  value: number;
  skew?: boolean;
  label: string;
}) {
  const width = Math.max(0, Math.min(100, value));
  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(width)}
      data-skew={skew ? '' : undefined}
      className="h-1.5 overflow-hidden rounded-full bg-(--ssz-bg-muted)"
    >
      <i
        className="block h-full rounded-[inherit] transition-[width] duration-(--ssz-duration-slow) ease-(--ssz-ease-out)"
        style={{
          width: `${width}%`,
          background: skew ? 'var(--ssz-color-warning-500)' : 'var(--ssz-color-primary-500)',
        }}
      />
    </div>
  );
}

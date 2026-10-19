'use client';

import { useTranslations } from 'next-intl';

import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

/**
 * Controls the design calls for that content-service cannot back yet — the
 * level subtitle and module code (plan 39, B9/B10), and Duplicate on a row
 * whose material is placed again instead. Per-block publish, the block's
 * check settings and points, sequential unlock and the block-type select were
 * dropped rather than built (plan 39, B2/B4/B6/B11; plan 76, Q4).
 *
 * The rule these enforce: the control appears where the design puts it, but it
 * never accepts input and never reports success. An author who flips a switch
 * that silently does not save is worse off than one who sees the switch is not
 * available — they only find out when the setting turns out never to have
 * existed.
 *
 * `aria-disabled` rather than `disabled`: a disabled button takes no pointer
 * events, so its tooltip never opens and the keyboard skips it entirely — the
 * two ways an author would otherwise learn why it does nothing.
 */
function useStubLabel(label: string) {
  const t = useTranslations('Authoring.stub');
  return `${label} — ${t('notAvailable')}`;
}

/**
 * Placeholder values for the inspector's stub fields.
 *
 * Kept together so they read as one obviously-fake set and can be deleted in
 * one pass when plan 39 gives these fields a backend — a plausible number
 * scattered through a component is the kind of thing that survives the cleanup
 * and then gets mistaken for data.
 */
export const STUB_PLACEHOLDERS = {
  code: 'L17-A',
  /** For a field the domain has no value for at all, rather than an invented one. */
  none: '—',
} as const;

/**
 * The shared body of a stub field: a control-shaped box that never takes input.
 *
 * Dashed rather than solid, and reachable by keyboard with the reason in its
 * accessible name — the whole point is that it is legible as "not yet" at a
 * glance and on a screen reader, not as an empty or broken field.
 */
function StubBox({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  const title = useStubLabel(label);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            aria-disabled="true"
            aria-label={title}
            tabIndex={0}
            className={cn(
              'flex cursor-not-allowed items-center rounded-md border border-dashed border-border',
              'bg-muted/30 px-3 py-1.5 text-sm text-muted-foreground/70',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              className,
            )}
          >
            {children}
          </div>
        </TooltipTrigger>
        <TooltipContent>{title}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function StubLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
      {children}
    </span>
  );
}

/** A labelled text field the backend cannot store yet. */
export function StubField({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <StubLabel>{label}</StubLabel>
      <StubBox label={label}>
        <span className="truncate">{value}</span>
      </StubBox>
    </div>
  );
}

export function StubIconButton({
  icon,
  label,
  reason,
  className,
}: {
  icon: React.ReactNode;
  label: string;
  /**
   * Why the control does nothing here, when it is not a backend still to come —
   * Duplicate on a vocabulary list, which is placed again instead. Said as is,
   * in place of the «not available yet» note.
   */
  reason?: string;
  className?: string;
}) {
  const stubTitle = useStubLabel(label);
  const title = reason ?? stubTitle;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            role="button"
            aria-disabled="true"
            aria-label={title}
            tabIndex={0}
            className={cn(
              'flex size-6 shrink-0 cursor-not-allowed items-center justify-center rounded-xs text-muted-foreground opacity-40',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              className,
            )}
          >
            {icon}
          </span>
        </TooltipTrigger>
        <TooltipContent>{title}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

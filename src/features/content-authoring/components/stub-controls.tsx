'use client';

import { ChevronDown } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

/**
 * Controls the design calls for that content-service cannot back yet
 * (plan 38 §3 — duplicate, per-block publish, cross-module move, and the
 * lesson/block fields the inspector shows).
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
 * The same contract as `StubIconButton` where the design shows a labelled
 * button — the bulk bar's Duplicate / Publish / Unpublish, which need the words
 * to say what the selection would do once the backend can do it.
 */
export function StubButton({ label, className }: { label: string; className?: string }) {
  const title = useStubLabel(label);

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
              'inline-flex h-7 cursor-not-allowed items-center rounded-full px-2.5 text-xs opacity-40',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              className,
            )}
          >
            {label}
          </span>
        </TooltipTrigger>
        <TooltipContent>{title}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
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
  minutes: '8',
  points: '5',
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

/** Same, shaped like a dropdown — the design uses selects where the choice is closed. */
export function StubSelectField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <StubLabel>{label}</StubLabel>
      <StubBox label={label}>
        <span className="truncate">{value}</span>
        <ChevronDown size={14} className="ml-auto shrink-0 opacity-60" />
      </StubBox>
    </div>
  );
}

/** A multi-line field (learning goals), shown empty with its prompt. */
export function StubTextareaField({ label, placeholder }: { label: string; placeholder: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <StubLabel>{label}</StubLabel>
      <StubBox label={label} className="min-h-16 items-start py-2">
        <span className="text-muted-foreground/60">{placeholder}</span>
      </StubBox>
    </div>
  );
}

/**
 * The three-way publish segment of the design, which no node can be switched
 * through from here (B2): publishing is a property of a container version and
 * happens in one place, "Review & publish".
 */
export function StubSegmentedField({
  label,
  options,
  activeValue,
}: {
  label: string;
  options: { value: string; label: string }[];
  activeValue: string | null;
}) {
  const title = useStubLabel(label);

  return (
    <div className="flex flex-col gap-1.5">
      <StubLabel>{label}</StubLabel>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              aria-disabled="true"
              aria-label={title}
              tabIndex={0}
              className={cn(
                'flex cursor-not-allowed gap-0.5 rounded-md border border-dashed border-border',
                'bg-muted/30 p-0.5 opacity-70',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              )}
            >
              {options.map((option) => (
                <span
                  key={option.value}
                  className={cn(
                    'flex-1 rounded-sm px-2 py-1 text-center text-xs',
                    option.value === activeValue
                      ? 'bg-background text-foreground shadow-[var(--ssz-shadow-xs)]'
                      : 'text-muted-foreground',
                  )}
                >
                  {option.label}
                </span>
              ))}
            </div>
          </TooltipTrigger>
          <TooltipContent>{title}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}

/** A setting the design puts on a switch — shown in its default position, unmovable. */
export function StubSwitchRow({ label, hint, on }: { label: string; hint: string; on?: boolean }) {
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
              'flex cursor-not-allowed items-center justify-between gap-3 border-t border-border py-2',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            )}
          >
            <p className="text-sm text-muted-foreground">
              {label}
              <span className="block text-xs text-muted-foreground/70">{hint}</span>
            </p>
            <span
              className={cn(
                'relative h-5.5 w-9.5 shrink-0 rounded-full border border-dashed opacity-50',
                on ? 'border-primary bg-primary/40' : 'border-border bg-muted',
              )}
            >
              <span
                className={cn(
                  'absolute top-0.5 size-4 rounded-full bg-background shadow-[var(--ssz-shadow-xs)] transition-transform',
                  on ? 'left-0.5 translate-x-4' : 'left-0.5',
                )}
              />
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent>{title}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function StubIconButton({
  icon,
  label,
  className,
}: {
  icon: React.ReactNode;
  label: string;
  className?: string;
}) {
  const title = useStubLabel(label);

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

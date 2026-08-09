'use client';

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

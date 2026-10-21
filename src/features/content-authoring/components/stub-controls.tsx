'use client';

import { useTranslations } from 'next-intl';

import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

/**
 * A control the design puts somewhere it cannot work — today only ⧉ on a row
 * whose material is placed again rather than copied (a vocabulary list or a
 * grammar rule). The structure editor's other stubs were dropped rather than
 * built (plan 39, B2/B4/B6/B9/B10/B11; plan 76, Q4).
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

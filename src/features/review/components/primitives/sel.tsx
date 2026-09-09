'use client';

import { ChevronDown } from 'lucide-react';

import { cn } from '@/lib/utils';

/** The value that means "do not narrow anything" — a real value, never an empty string. */
export const ALL = 'all';

export interface SelOption {
  id: string;
  label: string;
}

export interface SelProps {
  /** Names the filter for a screen reader; the chip itself shows only the value. */
  label: string;
  /** `null` is the unfiltered state — it renders as the "all …" option. */
  value: string | null;
  options: SelOption[];
  allLabel: string;
  onChange: (value: string | null) => void;
  className?: string;
}

/**
 * One filter, as a native `<select>` wearing a chip.
 *
 * Native on purpose (`COMPONENTS.md` §A). Three of these sit in a 352 px column beside a
 * toggle, and a scripted listbox there costs a portal, a focus trap and a scroll lock for
 * a control that is a plain one-of-N choice. The platform's own picker is also the one
 * that behaves on a phone, where this column becomes the whole screen.
 *
 * "All" is a value rather than the absence of one. A select whose unfiltered state is an
 * empty string has no option to return to, so clearing a filter would mean reaching for
 * something outside the control.
 */
export function Sel({ label, value, options, allLabel, onChange, className }: SelProps) {
  if (options.length === 0) return null;

  return (
    <span className={cn('relative inline-flex items-center', className)}>
      <select
        aria-label={label}
        value={value ?? ALL}
        onChange={(event) => onChange(event.target.value === ALL ? null : event.target.value)}
        className={cn(
          'max-w-[150px] cursor-pointer appearance-none truncate rounded-[9px] border-[1.5px] border-border',
          'bg-(--ssz-bg-surface) py-1.5 pl-2.5 pr-6 text-xs font-semibold outline-none',
          'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
          // The unfiltered state is secondary text: it says "nothing has been narrowed
          // here", which should not read as loudly as a choice somebody made.
          value === null ? 'text-muted-foreground' : 'text-foreground',
        )}
      >
        <option value={ALL}>{allLabel}</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown
        aria-hidden
        className="pointer-events-none absolute right-1.5 h-3.5 w-3.5 text-muted-foreground"
      />
    </span>
  );
}

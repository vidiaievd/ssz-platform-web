import type { LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

export type ReminderTone = 'primary' | 'info' | 'amber';

/** `accent` tints the rail/icon badge; `text` is the -700 shade used for text and CTA
 * background so it stays readable against white (the raw accent fails 4.5:1 as text). */
const TONE_COLOR: Record<ReminderTone, { accent: string; text: string }> = {
  primary: { accent: 'oklch(0.62 0.105 168)', text: 'var(--ssz-color-primary-700)' },
  info: { accent: 'oklch(0.60 0.12 235)', text: 'var(--ssz-color-info-700)' },
  amber: { accent: 'oklch(0.66 0.11 70)', text: 'var(--ssz-color-warning-700)' },
};

export interface ReminderCardProps {
  tone?: ReminderTone;
  icon: LucideIcon;
  overline: string;
  children: React.ReactNode;
  cta?: string;
  onCta?: () => void;
  className?: string;
}

/** Coloured-rail reminder card used for "Next class" / "Time to review" style prompts. */
export function ReminderCard({
  tone = 'primary',
  icon: Icon,
  overline,
  children,
  cta,
  onCta,
  className,
}: ReminderCardProps) {
  const { accent, text } = TONE_COLOR[tone];

  return (
    <div
      className={cn(
        'overflow-hidden rounded-lg border-[1.5px] border-(--ssz-border-default) bg-surface shadow-(--ssz-shadow-xs)',
        className,
      )}
    >
      <div className="h-1" style={{ background: accent }} />
      <div className="p-4">
        <div className="mb-3 flex items-center gap-2">
          <div
            className="flex size-7.5 items-center justify-center rounded-md"
            style={{ background: `${accent}1f` }}
          >
            <Icon size={16} style={{ color: accent }} aria-hidden="true" />
          </div>
          <span
            className="text-[11px] font-bold tracking-wider uppercase"
            style={{ color: text }}
          >
            {overline}
          </span>
        </div>
        {children}
        {cta && (
          <button
            type="button"
            onClick={onCta}
            className="mt-3.5 inline-flex w-full items-center justify-center gap-1.75 rounded-md px-4 py-2.5 text-[13px] font-bold text-white transition-opacity duration-base ease-out-ssz hover:opacity-90"
            style={{ background: text }}
          >
            {cta}
          </button>
        )}
      </div>
    </div>
  );
}

'use client';

import { Switch } from '@/components/ui/switch';

export interface ToggleRowProps {
  label: string;
  help: string;
  checked: boolean;
  /** Why this setting cannot be used right now. Present means the row is inert. */
  disabledReason?: string;
  onChange: (checked: boolean) => void;
}

/**
 * One setting in the builder: what it does, and whether it is on.
 *
 * When it is inert the reason replaces the help line rather than hiding in a tooltip: a
 * disabled switch takes no focus, so a tooltip would be reachable by mouse only, and the
 * author most in need of the explanation is the one who cannot hover. The `title` is
 * there as well, for the pointer that goes looking.
 */
export function ToggleRow({ label, help, checked, disabledReason, onChange }: ToggleRowProps) {
  const inert = disabledReason !== undefined;

  return (
    <label
      className={`flex items-start justify-between gap-4 ${inert ? 'opacity-60' : ''}`}
      title={disabledReason}
    >
      <span>
        <span className="block text-sm">{label}</span>
        <span className={`block text-xs ${inert ? 'text-warning-700' : 'text-muted-foreground'}`}>
          {disabledReason ?? help}
        </span>
      </span>
      <Switch checked={checked} disabled={inert} onCheckedChange={onChange} />
    </label>
  );
}

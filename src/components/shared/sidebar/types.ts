import type React from 'react';

export type NavItem = {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Key within the 'Nav' translation namespace. */
  labelKey: string;
  match?: (pathname: string) => boolean;
  /** Role-gated: render as non-interactive with lock affordance. */
  disabled?: boolean;
  /** i18n key for the tooltip explaining why the item is locked. */
  lockReason?: string;
  /** Count shown as a pill next to the label (e.g. reviews due now). Omitted when 0/undefined. */
  badge?: number;
};

export type NavSection = {
  /** Key within the 'Nav' translation namespace, rendered as a section header. */
  titleKey?: string;
  items: NavItem[];
};

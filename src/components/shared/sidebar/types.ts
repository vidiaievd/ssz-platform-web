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
  /**
   * Something inside that count is late — drawn as a dot on the pill, never as a second
   * number.
   *
   * A number would invite arithmetic in the margin of a screen nobody is looking at yet;
   * the dot says only "this is worth opening now", and the screen behind it is where how
   * many and how late are answered (review criterion 9).
   */
  badgeAlert?: boolean;
};

export type NavSection = {
  /** Key within the 'Nav' translation namespace, rendered as a section header. */
  titleKey?: string;
  items: NavItem[];
};

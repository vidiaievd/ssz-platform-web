import type React from 'react';

export type NavItem = {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Key within the 'Nav' translation namespace. */
  labelKey: string;
  match?: (pathname: string) => boolean;
};

export type NavSection = {
  /** Key within the 'Nav' translation namespace, rendered as a section header. */
  titleKey?: string;
  items: NavItem[];
};

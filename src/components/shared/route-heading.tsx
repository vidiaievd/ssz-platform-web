'use client';

import type { ComponentPropsWithoutRef } from 'react';

import { cn } from '@/lib/utils';
import { useFocusOnRouteChange } from '@/lib/a11y/use-focus-on-route-change';

type HeadingTag = 'h1' | 'h2' | 'h3';

type RouteHeadingProps = {
  as?: HeadingTag;
} & Omit<ComponentPropsWithoutRef<'h1'>, 'ref' | 'tabIndex'>;

/**
 * Page heading that takes focus on client-side route change (design gaps
 * doc §10). `tabIndex={-1}` makes it programmatically focusable without
 * joining the tab order.
 */
export function RouteHeading({ as, className, ...props }: RouteHeadingProps) {
  const Component = as ?? 'h1';
  const ref = useFocusOnRouteChange<HTMLHeadingElement>();

  return <Component ref={ref} tabIndex={-1} className={cn('outline-none', className)} {...props} />;
}

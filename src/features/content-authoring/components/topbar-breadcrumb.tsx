'use client';

import { Breadcrumbs, type BreadcrumbItem } from '@/components/shared/breadcrumbs';
import { TopbarPortal } from '@/components/shared/topbar/topbar-slot';

/**
 * The lesson editor's breadcrumb, rendered in the app's top bar rather than on the
 * page (the builder specs' top row).
 *
 * Hidden on a narrow screen: the bar there is a hamburger, a workspace switcher and
 * a user menu, and a four-level path would leave none of them room. Authoring is a
 * desk job, and the material's name is in the browser tab and in the editor either
 * way.
 */
export function TopbarBreadcrumb({ items }: { items: BreadcrumbItem[] }) {
  return (
    <TopbarPortal>
      <Breadcrumbs items={items} variant="bar" className="hidden min-w-0 md:flex" />
    </TopbarPortal>
  );
}

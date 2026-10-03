'use client';

import { useTranslations } from 'next-intl';

import { usePathname } from '@/lib/i18n/navigation';

import { Breadcrumbs, type BreadcrumbItem } from '../breadcrumbs';

/** Leading segments that say where the app is, not what the page is: `w/<id>`, `school/<slug>`, … */
const SCOPE_PREFIX: Record<string, number> = { w: 2, school: 2, tutor: 2, student: 1, s: 2 };

const kebabToCamel = (segment: string) =>
  segment.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());

/**
 * The top bar's breadcrumb for every page that does not draw its own.
 *
 * Read off the path, so a new route gets a trail for free the moment its segment
 * has a name. It stops at the first segment it cannot name — an id, which is a
 * record the page knows the title of and this component does not. Such pages
 * claim the slot themselves (`TopbarBreadcrumb`) and replace this trail.
 */
export function AutoBreadcrumbs() {
  const pathname = usePathname();
  const nav = useTranslations('Nav');
  const crumb = useTranslations('Nav.crumb');

  const segments = pathname.split('/').filter(Boolean);
  const skip = SCOPE_PREFIX[segments[0] ?? ''] ?? 0;
  const base = '/' + segments.slice(0, skip).join('/');
  const rest = segments.slice(skip);

  const label = (segment: string): string | null => {
    const key = kebabToCamel(segment);
    if (crumb.has(key as 'new')) return crumb(key as 'new');
    if (nav.has(key as 'home')) return nav(key as 'home');
    return null;
  };

  const items: BreadcrumbItem[] = [];
  for (let i = 0; i < rest.length; i += 1) {
    const text = label(rest[i]!);
    if (!text) break;
    // `review/oversight` is one screen named by the nav as a whole.
    if (rest[i] === 'oversight' && items.length > 0) {
      items[items.length - 1] = { label: nav('reviewOversight') };
      continue;
    }
    items.push({ label: text, href: `${base}/${rest.slice(0, i + 1).join('/')}` });
  }

  return <Breadcrumbs items={items} variant="bar" className="hidden min-w-0 md:flex" />;
}

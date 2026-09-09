import { ChevronRight } from 'lucide-react';
import * as React from 'react';

import { cn } from '@/lib/utils';
import { Link } from '@/lib/i18n/navigation';

export type BreadcrumbItem = {
  label: string;
  href?: string;
};

type BreadcrumbsProps = {
  items: BreadcrumbItem[];
  /**
   * `bar` is the builder specs' `.wb-crumbs`: smaller, wider-tracked, with a filled
   * triangle between crumbs instead of a chevron icon. It exists because the app's top
   * bar is 56px tall and shared with a workspace switcher and a user menu — the page
   * variant, sized for a page, does not fit there.
   */
  variant?: 'page' | 'bar';
  className?: string;
};

export function Breadcrumbs({ items, variant = 'page', className }: BreadcrumbsProps) {
  if (items.length === 0) return null;

  const bar = variant === 'bar';

  return (
    <nav
      aria-label="Breadcrumb"
      className={cn(
        'flex items-center',
        bar ? 'gap-1.5 text-xs tracking-wide' : 'gap-1 text-sm',
        className,
      )}
    >
      <ol className={cn('flex min-w-0 items-center', bar ? 'gap-1.5' : 'gap-1')}>
        {items.map((item, i) => {
          const isLast = i === items.length - 1;
          return (
            <li key={i} className={cn('flex min-w-0 items-center', bar ? 'gap-1.5' : 'gap-1')}>
              {i > 0 &&
                (bar ? (
                  <span aria-hidden="true" className="text-muted-foreground">
                    ▸
                  </span>
                ) : (
                  <ChevronRight className="size-3.5 text-muted-foreground" aria-hidden="true" />
                ))}
              {isLast || !item.href ? (
                <span
                  aria-current={isLast ? 'page' : undefined}
                  className={cn(
                    'truncate',
                    isLast
                      ? bar
                        ? 'font-semibold text-foreground'
                        : 'font-medium text-foreground'
                      : bar
                        ? 'text-(--ssz-text-secondary)'
                        : 'text-muted-foreground',
                  )}
                >
                  {item.label}
                </span>
              ) : (
                <Link
                  href={item.href}
                  className={cn(
                    'truncate transition-colors hover:text-foreground',
                    bar ? 'text-(--ssz-text-secondary)' : 'text-muted-foreground',
                  )}
                >
                  {item.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

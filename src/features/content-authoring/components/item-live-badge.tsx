'use client';

import { useTranslations } from 'next-intl';

import { Badge } from '@/components/ui/badge';

interface ItemLiveBadgeProps {
  /**
   * Whether the owning container's published version places this item, as the
   * curriculum tree reports it. `null` — that container has never been
   * published, and its own badge already says so.
   */
  isLive: boolean | null;
  className?: string;
}

/**
 * Marks material students cannot open yet.
 *
 * Deliberately silent for live items: in a module of sixteen, a badge on every
 * row is noise, and the one thing the author needs to spot is the exception —
 * what they just added and have not released.
 */
export function ItemLiveBadge({ isLive, className }: ItemLiveBadgeProps) {
  const t = useTranslations('Authoring.publishState');

  if (isLive !== false) return null;

  return (
    <Badge variant="warning" className={className} aria-label={t('itemAwaitingAriaLabel')}>
      {t('itemAwaiting')}
    </Badge>
  );
}

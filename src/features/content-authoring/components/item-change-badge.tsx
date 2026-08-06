'use client';

import { useTranslations } from 'next-intl';

import { Badge } from '@/components/ui/badge';
import type { CurriculumTreeItemNode } from '@/features/content/types';

import { ItemLiveBadge } from './item-live-badge';

interface ItemChangeBadgeProps {
  item: CurriculumTreeItemNode;
  className?: string;
}

/**
 * What publishing this module would change about *this* row.
 *
 * The module badge says a release is outstanding; without this the author has
 * to diff the tree by memory to find out which rows it is about. Silent for
 * rows that did not change — a badge on every row would say nothing.
 *
 * An added row is the same fact as "students cannot open this yet", so it keeps
 * the wording it already had rather than gaining a second vocabulary.
 */
export function ItemChangeBadge({ item, className }: ItemChangeBadgeProps) {
  const t = useTranslations('Authoring.publishState');

  switch (item.pendingChange) {
    case 'moved':
      return (
        <Badge variant="info" className={className} aria-label={t('itemMovedAriaLabel')}>
          {t('itemMoved')}
        </Badge>
      );
    case 'flags_changed':
      return (
        <Badge variant="info" className={className} aria-label={t('itemFlagsChangedAriaLabel')}>
          {t('itemFlagsChanged')}
        </Badge>
      );
    // 'added' and the null case both come down to liveness: a row the live
    // version does not place, or a container with no diff to report.
    default:
      return <ItemLiveBadge isLive={item.isLive} className={className} />;
  }
}

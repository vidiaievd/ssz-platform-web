'use client';

import { useTranslations } from 'next-intl';

import { Badge } from '@/components/ui/badge';
import type { ContainerPublishState } from '@/features/content/types';

const VARIANT: Record<ContainerPublishState, 'warning' | 'success' | 'info'> = {
  draft: 'warning',
  published: 'success',
  pending_changes: 'info',
};

const LABEL_KEY: Record<ContainerPublishState, 'draft' | 'published' | 'pendingChanges'> = {
  draft: 'draft',
  published: 'published',
  pending_changes: 'pendingChanges',
};

interface PublishStateBadgeProps {
  state: ContainerPublishState;
  className?: string;
}

/**
 * Live/not-live status of a container, including the case the plain
 * `ContainerStateBadge` cannot express: published, but with a draft that is
 * ahead of what students see.
 */
export function PublishStateBadge({ state, className }: PublishStateBadgeProps) {
  const t = useTranslations('Authoring.publishState');
  const label = t(LABEL_KEY[state]);
  return (
    <Badge variant={VARIANT[state]} className={className} aria-label={t('ariaLabel', { label })}>
      {label}
    </Badge>
  );
}

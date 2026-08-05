'use client';

import { useTranslations } from 'next-intl';

import { Badge } from '@/components/ui/badge';
import type { Container } from '@/features/content/types';

/**
 * True when anything in this container is waiting to be released — its own
 * draft is ahead of the live version, or it holds a module students cannot
 * open. Undefined fields (a list the BFF did not enrich) mean "don't know",
 * which must not read as "nothing pending".
 */
export function hasPendingChanges(container: Container): boolean {
  return (
    container.publishState === 'pending_changes' ||
    container.publishState === 'draft' ||
    (container.pendingModuleCount ?? 0) > 0
  );
}

interface PendingChangesBadgeProps {
  container: Container;
  className?: string;
}

/**
 * Sits *next to* the published/draft badge rather than replacing it: "Published"
 * is still true, and the thing the author cannot otherwise see from a list is
 * that a release is outstanding.
 */
export function PendingChangesBadge({ container, className }: PendingChangesBadgeProps) {
  const t = useTranslations('Authoring.publishState');

  // A container that has never been published is already badged "Draft" — a
  // second badge saying the same thing is noise.
  if (!container.currentPublishedVersionId || !hasPendingChanges(container)) return null;

  const pendingModules = container.pendingModuleCount ?? 0;

  return (
    <Badge
      variant="info"
      className={className}
      aria-label={t('pendingChangesAriaLabel', { count: pendingModules })}
    >
      {pendingModules > 0 && container.publishState === 'published'
        ? t('pendingModules', { count: pendingModules })
        : t('pendingChanges')}
    </Badge>
  );
}

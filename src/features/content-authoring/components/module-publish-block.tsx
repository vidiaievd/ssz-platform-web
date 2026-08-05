'use client';

import { useTranslations } from 'next-intl';

import type { ContainerPublishState } from '@/features/content/types';

import { PublishStateBadge } from './publish-state-badge';

interface ModulePublishBlockProps {
  publishState: ContainerPublishState;
}

/**
 * Publish state of a single module, as reported by the curriculum tree.
 *
 * A module is versioned in its own right: the student reader resolves a
 * module's `currentPublishedVersionId`, so anything added to its draft — a new
 * exercise, a lesson — stays invisible until the module itself is published,
 * and publishing the course does not cascade. The release happens in one place
 * for the whole course ("Review & publish" in the header), so this block
 * reports rather than acts.
 */
export function ModulePublishBlock({ publishState }: ModulePublishBlockProps) {
  const t = useTranslations('Authoring.structure');

  return (
    <div className="space-y-2.5 border-t border-border pt-4">
      <div className="flex items-center gap-2">
        <span className="text-xs font-bold tracking-wide text-muted-foreground">
          {t('modulePublishLabel')}
        </span>
        <PublishStateBadge state={publishState} />
      </div>

      <p className="text-xs leading-relaxed text-muted-foreground">
        {publishState === 'draft'
          ? t('modulePublishFirst')
          : publishState === 'pending_changes'
            ? t('modulePublishPending')
            : t('modulePublishUpToDate')}
      </p>
    </div>
  );
}

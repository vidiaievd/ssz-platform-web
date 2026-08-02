'use client';

import { useTranslations } from 'next-intl';
import { useQueryClient } from '@tanstack/react-query';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

import { useContainerVersions } from '../api/use-container-versions';
import { useContainerPreflight } from '../api/use-container-preflight';
import { authoringKeys } from '../api/keys';
import { ContainerStateBadge } from './container-state-badge';
import { PublishDialog } from './publish-dialog';

interface ModulePublishBlockProps {
  /** The module's own container id (not the course's). */
  containerId: string;
  /** Called after a successful publish so the tree can refetch. */
  onPublished?: () => void;
}

/**
 * Publish state and action for a single module.
 *
 * A module is versioned in its own right: the student reader resolves a
 * module's `currentPublishedVersionId`, so anything added to its draft — a new
 * exercise, a lesson — stays invisible until the module itself is published.
 * Publishing the course does not cascade.
 */
export function ModulePublishBlock({ containerId, onPublished }: ModulePublishBlockProps) {
  const t = useTranslations('Authoring.structure');
  const queryClient = useQueryClient();
  const { data: versions, isLoading } = useContainerVersions(containerId);

  const draft = versions?.find((v) => v.status === 'draft');
  const published = versions?.find((v) => v.status === 'published');

  // Only worth running once we know there is a draft to publish.
  const { data: preflight } = useContainerPreflight(containerId, !!draft);

  if (isLoading) {
    return (
      <div className="space-y-2 border-t border-border pt-4">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-8 w-28" />
      </div>
    );
  }

  if (!versions) return null;

  return (
    <div className="space-y-2.5 border-t border-border pt-4">
      <div className="flex items-center gap-2">
        <span className="text-xs font-bold tracking-wide text-muted-foreground">
          {t('modulePublishLabel')}
        </span>
        <ContainerStateBadge state={published ? 'published' : 'draft'} />
      </div>

      <p className="text-xs leading-relaxed text-muted-foreground">
        {draft
          ? published
            ? t('modulePublishPending')
            : t('modulePublishFirst')
          : t('modulePublishUpToDate')}
      </p>

      {draft && (
        <PublishDialog
          container={{ id: containerId }}
          result={preflight}
          trigger={
            <Button variant="primary" size="sm" type="button">
              {t('modulePublishAction')}
            </Button>
          }
          onPublished={() => {
            void queryClient.invalidateQueries({ queryKey: authoringKeys.versions(containerId) });
            void queryClient.invalidateQueries({ queryKey: authoringKeys.preflight(containerId) });
            onPublished?.();
          }}
        />
      )}
    </div>
  );
}

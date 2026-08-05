'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useQueryClient } from '@tanstack/react-query';

import { Button } from '@/components/ui/button';
import type { Container, ContainerPublishState } from '@/features/content/types';

import { useCurriculumTree } from '../api/use-curriculum-tree';
import { authoringKeys } from '../api/keys';
import type { PreflightResult } from '../types';
import { deriveContainerState } from './container-state-badge';
import { DiscardDraftDialog } from './discard-draft-dialog';
import { PreflightPanel } from './preflight-panel';
import { PublishStateBadge } from './publish-state-badge';

interface CoursePublishBlockProps {
  container: Container;
  /** Draft version id — the tree query key, shared with the structure panel. */
  draftVersionId: string | null;
  preflightResult?: PreflightResult;
}

/**
 * Publish state and action for the course container itself.
 *
 * A published course with a draft ahead of it must be publishable again — that
 * used to be the versions rail's job, and the rail was never mounted, so a
 * published course had no re-publish path outside the lesson editor header.
 *
 * The precise state comes from the curriculum tree, which content-service
 * computes by comparing the draft's composition against the published one.
 * The query is the one the structure panel already ran, so this is a cache
 * read rather than a second request.
 */
export function CoursePublishBlock({
  container,
  draftVersionId,
  preflightResult,
}: CoursePublishBlockProps) {
  const t = useTranslations('Authoring');
  const queryClient = useQueryClient();
  const [discardOpen, setDiscardOpen] = useState(false);
  const { data: tree } = useCurriculumTree(container.id, draftVersionId);

  // Before the tree lands we can still tell "never published" from "live",
  // just not "live with pending changes" — that distinction is what the tree
  // adds, and `deriveContainerState` provably cannot express it.
  const fallback: ContainerPublishState =
    deriveContainerState(container) === 'published' ? 'published' : 'draft';
  const state = tree?.publishState ?? fallback;

  const canPublish = state === 'draft' || state === 'pending_changes';

  function invalidatePublishState() {
    if (draftVersionId) {
      void queryClient.invalidateQueries({
        queryKey: authoringKeys.tree(container.id, draftVersionId),
      });
    }
  }

  return (
    <div className="space-y-3 border-t border-border pt-6">
      <div className="flex items-center gap-2">
        <span className="text-xs font-bold tracking-wide text-muted-foreground">
          {t('publish.blockLabel')}
        </span>
        <PublishStateBadge state={state} />
      </div>

      <p className="text-xs leading-relaxed text-muted-foreground">
        {state === 'draft'
          ? t('publish.blockNeverPublished')
          : state === 'pending_changes'
            ? t('publish.blockPending')
            : t('publish.blockUpToDate')}
      </p>

      {canPublish && (
        <>
          {/* Publishing itself lives in one place — the course header's
              "Review & publish", which releases the course together with the
              modules it depends on. Here we only report and diagnose. */}
          <p className="text-xs text-muted-foreground">{t('publish.blockWhereToPublish')}</p>
          {state === 'pending_changes' && (
            <Button variant="ghost" size="sm" type="button" onClick={() => setDiscardOpen(true)}>
              {t('discard.trigger')}
            </Button>
          )}
          <PreflightPanel containerId={container.id} result={preflightResult} />
        </>
      )}

      <DiscardDraftDialog
        containerId={container.id}
        open={discardOpen}
        onOpenChange={setDiscardOpen}
        onSuccess={invalidatePublishState}
      />
    </div>
  );
}

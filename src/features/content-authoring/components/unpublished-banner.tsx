'use client';

import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import type { CurriculumTree } from '@/features/content/types';

import { collectPublishRows } from '../lib/publish-rows';

interface UnpublishedBannerProps {
  tree: CurriculumTree;
  onReview: () => void;
}

/**
 * What of this course students cannot see, and a way to act on it.
 *
 * The headline count is `collectPublishRows` — the same rows the publish dialog
 * lists and the metric strip reports, so the three cannot disagree
 * (BEHAVIOR.md §5.2). The lines under it keep the breakdown the old summary
 * had: a course that was never published is a different problem from three
 * modules whose drafts ran ahead, and the count alone cannot tell them apart.
 */
export function UnpublishedBanner({ tree, onReview }: UnpublishedBannerProps) {
  const t = useTranslations('Authoring.structure');

  const count = collectPublishRows(tree, '').length;
  const modules = tree.levels.flatMap((level) => level.modules);
  const pendingModules = modules.filter((m) => m.publishState === 'pending_changes').length;
  const draftModules = modules.filter((m) => m.publishState === 'draft').length;

  if (count === 0) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-success-200 bg-success-50 px-3 py-2 text-xs text-success-800">
        <CheckCircle2 className="size-3.5 shrink-0" aria-hidden />
        <span>{t('publishSummaryAllLive')}</span>
      </div>
    );
  }

  const lines: string[] = [];
  if (tree.publishState === 'draft') lines.push(t('publishSummaryCourseDraft'));
  else if (tree.publishState === 'pending_changes') lines.push(t('publishSummaryCoursePending'));
  if (pendingModules > 0) lines.push(t('publishSummaryModulesPending', { count: pendingModules }));
  if (draftModules > 0) lines.push(t('publishSummaryModulesDraft', { count: draftModules }));

  return (
    <div className="flex items-start gap-2 rounded-lg border border-warning-200 bg-warning-50 px-3 py-2 text-xs text-warning-800">
      <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
      <div className="flex min-w-0 flex-col gap-0.5">
        <p>
          <b className="font-bold">{t('unpublishedBannerCount', { count })}</b>{' '}
          {t('unpublishedBannerHint')}
        </p>
        {lines.map((line) => (
          <span key={line} className="text-warning-700">
            {line}
          </span>
        ))}
      </div>
      <Button variant="outline" size="sm" className="ml-auto shrink-0" onClick={onReview}>
        {t('unpublishedBannerAction')}
      </Button>
    </div>
  );
}

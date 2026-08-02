'use client';

import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { cn } from '@/lib/utils';
import type { CurriculumTree } from '@/features/content/types';

interface CurriculumPublishSummaryProps {
  tree: CurriculumTree;
  className?: string;
}

/**
 * What of this course is not live, counted once instead of clicked out module
 * by module. Composition only: an edit to an existing exercise is already live
 * and deliberately does not show up here.
 */
export function CurriculumPublishSummary({ tree, className }: CurriculumPublishSummaryProps) {
  const t = useTranslations('Authoring.structure');

  const modules = tree.levels.flatMap((level) => level.modules);
  const pendingModules = modules.filter((m) => m.publishState === 'pending_changes').length;
  const draftModules = modules.filter((m) => m.publishState === 'draft').length;

  const lines: string[] = [];
  if (tree.publishState === 'draft') lines.push(t('publishSummaryCourseDraft'));
  else if (tree.publishState === 'pending_changes') lines.push(t('publishSummaryCoursePending'));
  if (pendingModules > 0) lines.push(t('publishSummaryModulesPending', { count: pendingModules }));
  if (draftModules > 0) lines.push(t('publishSummaryModulesDraft', { count: draftModules }));

  const allLive = lines.length === 0;

  return (
    <div
      className={cn(
        'flex items-start gap-2 rounded-lg border px-3 py-2 text-xs',
        allLive
          ? 'border-success-200 bg-success-50 text-success-800'
          : 'border-warning-200 bg-warning-50 text-warning-800',
        className,
      )}
    >
      {allLive ? (
        <CheckCircle2 className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
      ) : (
        <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
      )}
      <div className="flex flex-col gap-0.5">
        {allLive ? (
          <span>{t('publishSummaryAllLive')}</span>
        ) : (
          lines.map((line) => <span key={line}>{line}</span>)
        )}
      </div>
    </div>
  );
}

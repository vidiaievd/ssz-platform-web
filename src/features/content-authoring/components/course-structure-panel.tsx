'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { AccessTier, DifficultyLevel, Visibility } from '@/features/content/types';

import { useCurriculumTree } from '../api/use-curriculum-tree';
import type { CurriculumTreeSelection } from '../types';
import { findItemSelection, findLevelOrModuleSelection, resolveSelection } from '../lib/find-tree-item';
import { CurriculumTree } from './curriculum-tree';
import { CurriculumInspector } from './curriculum-inspector';

interface CourseStructurePanelProps {
  containerId: string;
  versionId: string;
  schoolSlug: string;
  /** Inherited by new lessons/vocab/grammar items (and modules) created from the tree. */
  targetLanguage: string;
  difficultyLevel: DifficultyLevel;
  visibility: Visibility;
  accessTier: AccessTier;
}

function StructureSkeleton() {
  return (
    <div className="grid grid-cols-1 items-start gap-4.5 lg:grid-cols-[1.5fr_1fr]">
      <Skeleton className="h-96 w-full rounded-2xl" />
      <Skeleton className="h-64 w-full rounded-2xl" />
    </div>
  );
}

export function CourseStructurePanel({
  containerId,
  versionId,
  schoolSlug,
  targetLanguage,
  difficultyLevel,
  visibility,
  accessTier,
}: CourseStructurePanelProps) {
  const t = useTranslations('Authoring');
  const [selection, setSelection] = useState<CurriculumTreeSelection | null>(null);
  const { data: tree, isLoading, isError, refetch } = useCurriculumTree(containerId, versionId);

  async function handleChanged(selectId?: string, kind: 'level' | 'module' | 'item' = 'item') {
    const { data: freshTree } = await refetch();
    if (!freshTree) return;
    if (selectId) {
      const found =
        kind === 'item'
          ? findItemSelection(freshTree, selectId)
          : findLevelOrModuleSelection(freshTree, kind, selectId);
      if (found) setSelection(found);
      return;
    }
    // No specific node to select — re-resolve the current selection (if any)
    // against the fresh tree so in-place edits (rename, …) don't leave the
    // Inspector holding a stale snapshot of the node it just saved.
    setSelection((current) => (current ? resolveSelection(freshTree, current) : current));
  }

  if (isLoading) return <StructureSkeleton />;

  if (isError || !tree) {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        <p className="text-sm text-muted-foreground">{t('structure.loadError')}</p>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          {t('structure.retry')}
        </Button>
      </div>
    );
  }

  const selectedId =
    selection?.kind === 'level'
      ? selection.level.id
      : selection?.kind === 'module'
        ? selection.module.id
        : selection?.kind === 'item'
          ? selection.item.id
          : null;

  return (
    <div className="grid grid-cols-1 items-start gap-4.5 lg:grid-cols-[1.5fr_1fr]">
      <div className="ssz-surface rounded-2xl border border-border p-3.5">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-bold text-foreground">{t('structure.sectionTitle')}</h2>
          <span className="text-xs text-muted-foreground">{t('structure.sectionHint')}</span>
        </div>
        <CurriculumTree
          tree={tree}
          selectedId={selectedId}
          onSelect={setSelection}
          onChanged={handleChanged}
          courseContainerId={containerId}
          targetLanguage={targetLanguage}
          difficultyLevel={difficultyLevel}
          visibility={visibility}
          accessTier={accessTier}
        />
      </div>
      <div className="ssz-surface sticky top-4 rounded-2xl border border-border p-4.5">
        <h2 className="mb-3 text-sm font-bold text-foreground">{t('structure.inspectorTitle')}</h2>
        <CurriculumInspector
          selection={selection}
          courseContainerId={containerId}
          schoolSlug={schoolSlug}
          onChanged={() => handleChanged()}
        />
      </div>
    </div>
  );
}

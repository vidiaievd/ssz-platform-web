'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { AccessTier, DifficultyLevel, Visibility } from '@/features/content/types';

import { useCurriculumTree } from '../api/use-curriculum-tree';
import type { CurriculumTreeSelection } from '../types';
import {
  findItemSelection,
  findLevelOrModuleSelection,
  resolveSelection,
} from '../lib/find-tree-item';
import { CurriculumTree } from './curriculum-tree';
import { CurriculumInspector } from './curriculum-inspector';
import { OutlineRail } from './outline-rail';
import { UnpublishedBanner } from './unpublished-banner';

interface CourseStructurePanelProps {
  containerId: string;
  versionId: string;
  schoolSlug: string;
  /** Inherited by new lessons/vocab/grammar items (and modules) created from the tree. */
  targetLanguage: string;
  difficultyLevel: DifficultyLevel;
  visibility: Visibility;
  accessTier: AccessTier;
  /** The course's owning school — new material inherits it, and `school_private` is invalid without it. */
  ownerSchoolId?: string | null;
  /** Collapse keys of folded nodes; owned by the shell, which also drives Expand/Collapse all. */
  collapsed: ReadonlySet<string>;
  onToggleCollapse: (key: string) => void;
  /** Unfolds one node — the rail needs this to jump into a collapsed level. */
  onExpand: (key: string) => void;
  /** Opens the publish dialog, which the shell owns. */
  onReview: () => void;
}

function StructureSkeleton() {
  return (
    <div className="grid grid-cols-1 items-start gap-4.5 xl:grid-cols-[minmax(190px,220px)_minmax(0,1fr)_minmax(280px,340px)]">
      <Skeleton className="hidden h-64 w-full rounded-2xl xl:block" />
      <Skeleton className="h-96 w-full rounded-2xl" />
      <Skeleton className="h-64 w-full rounded-2xl" />
    </div>
  );
}

/**
 * The three-pane workspace: outline rail · structure tree · inspector.
 *
 * The rail and the inspector are both sticky — an author works in the tree and
 * needs the jump list and the fields of whatever is selected to stay put while
 * it scrolls.
 */
export function CourseStructurePanel({
  containerId,
  versionId,
  schoolSlug,
  targetLanguage,
  difficultyLevel,
  visibility,
  accessTier,
  ownerSchoolId,
  collapsed,
  onToggleCollapse,
  onExpand,
  onReview,
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
    // No `items-start`: the side columns must stretch to the row's full height,
    // or their sticky children have no room to travel and scroll away with the
    // tree. The tree card gets `self-start` back so it still hugs its content.
    <div className="grid grid-cols-1 gap-4.5 xl:grid-cols-[minmax(190px,220px)_minmax(0,1fr)_minmax(280px,340px)]">
      <div className="hidden xl:block">
        <OutlineRail
          tree={tree}
          courseContainerId={containerId}
          selectedId={selectedId}
          onExpand={onExpand}
          onSelectLevel={(levelId) => {
            const level = tree.levels.find((l) => l.id === levelId);
            if (level) setSelection({ kind: 'level', level });
          }}
          onChanged={handleChanged}
        />
      </div>

      <div className="ssz-surface self-start rounded-2xl border border-border p-3.5">
        <UnpublishedBanner tree={tree} onReview={onReview} />
        <div className="mt-2.5">
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
            ownerSchoolId={ownerSchoolId}
            collapsed={collapsed}
            onToggleCollapse={onToggleCollapse}
          />
        </div>
      </div>

      <div>
        <div className="ssz-surface sticky top-[var(--structure-sticky-top,1rem)] rounded-2xl border border-border p-4.5">
          <h2 className="mb-3 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
            {t('structure.inspectorTitle')}
          </h2>
          <CurriculumInspector
            selection={selection}
            courseContainerId={containerId}
            schoolSlug={schoolSlug}
            onChanged={() => handleChanged()}
          />
        </div>
      </div>
    </div>
  );
}

'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { AccessTier, DifficultyLevel, Visibility } from '@/features/content/types';

import { useCurriculumTree } from '../api/use-curriculum-tree';
import { useContainerCoverage } from '../api/use-container-coverage';
import { recipeIssuesByModule } from '../lib/coverage-triage';
import type { CurriculumTreeSelection } from '../types';
import {
  findItemSelection,
  findLevelOrModuleSelection,
  resolveSelection,
} from '../lib/find-tree-item';
import { EMPTY_FILTERS, type StructureFilters } from '../lib/structure-filters';
import { useNodeDeletion } from '../hooks/use-node-deletion';
import { StructureUndoProvider } from '../hooks/use-structure-undo';
import { CurriculumTree } from './curriculum-tree';
import { DeleteNodeDialog } from './delete-node-dialog';
import { CurriculumInspector } from './curriculum-inspector';
import { OutlineRail } from './outline-rail';
import { StructureToolbar } from './structure-toolbar';
import { UnpublishedBanner } from './unpublished-banner';

interface CourseStructurePanelProps {
  containerId: string;
  versionId: string;
  workspaceId: string;
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
  /** Folds or unfolds everything; read from the toolbar above the tree. */
  onExpandAll: () => void;
  onCollapseAll: () => void;
  /** Opens the publish dialog, which the shell owns. */
  onReview: () => void;
  /** Where the tree starts filtered, when something sent the author here to look at one thing. */
  initialFilters?: StructureFilters;
}

function StructureSkeleton() {
  return (
    <div className="grid grid-cols-1 items-start gap-6 min-[1000px]:grid-cols-[260px_minmax(0,1fr)] min-[1400px]:grid-cols-[236px_minmax(0,1fr)_348px]">
      <Skeleton className="hidden h-64 w-full rounded-2xl min-[1000px]:block" />
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
  workspaceId,
  targetLanguage,
  difficultyLevel,
  visibility,
  accessTier,
  ownerSchoolId,
  collapsed,
  onToggleCollapse,
  onExpand,
  onExpandAll,
  onCollapseAll,
  onReview,
  initialFilters,
}: CourseStructurePanelProps) {
  const t = useTranslations('Authoring');
  const [selection, setSelection] = useState<CurriculumTreeSelection | null>(null);
  // Seeded, not controlled: a triage button hands the tree a starting filter,
  // and from then on the toolbar owns it — a URL that kept overriding what the
  // author typed would be a filter they cannot clear.
  const [filters, setFilters] = useState<StructureFilters>(initialFilters ?? EMPTY_FILTERS);
  const { data: tree, isLoading, isError, refetch } = useCurriculumTree(containerId, versionId);
  // The same report the health strip reads, so the dots cost no request of their own.
  const { data: coverage } = useContainerCoverage(containerId);
  const recipeIssues = useMemo(() => recipeIssuesByModule(coverage), [coverage]);

  /**
   * Deleting from the inspector's footer, confirmed in the same dialog the row
   * menus use. Called above the early returns because it is a hook — it simply
   * has nothing to act on until the tree arrives.
   */
  const deletion = useNodeDeletion({
    tree,
    courseContainerId: containerId,
    onChanged: () => void handleChanged(),
  });

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
    <StructureUndoProvider onChanged={() => void handleChanged()}>
      {/* No `items-start`: the side columns must stretch to the row's full
          height, or their sticky children have no room to travel and scroll
          away with the tree. The tree card gets `self-start` back so it still
          hugs its content. */}
      {/* Three columns while there is room for three; at 1400px the inspector
          drops into the flow under the tree rather than squeezing it; at 1000px
          the rail goes too — a jump list 120px wide is not a jump list
          (BEHAVIOR §4). */}
      <div className="grid grid-cols-1 gap-6 min-[1000px]:grid-cols-[260px_minmax(0,1fr)] min-[1400px]:grid-cols-[236px_minmax(0,1fr)_348px]">
        {/* Spans the inspector's row too while that sits under the tree (below
            1400px): a sticky pane can only travel inside its own grid area, so
            confined to the tree's row it ran out at the end of the tree and was
            carried up behind the header. */}
        <div className="hidden min-[1000px]:row-span-2 min-[1000px]:block min-[1400px]:row-span-1">
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

        <div className="ssz-surface self-start overflow-hidden rounded-2xl border border-border shadow-[var(--ssz-shadow-xs)]">
          <StructureToolbar
            filters={filters}
            onChange={setFilters}
            onExpandAll={onExpandAll}
            onCollapseAll={onCollapseAll}
          />
          <div className="p-3.5">
            <div>
              <UnpublishedBanner tree={tree} onReview={onReview} />
            </div>
            <div className="mt-2.5">
              <CurriculumTree
                tree={tree}
                selectedId={selectedId}
                onSelect={setSelection}
                onChanged={handleChanged}
                courseContainerId={containerId}
                workspaceId={workspaceId}
                targetLanguage={targetLanguage}
                difficultyLevel={difficultyLevel}
                visibility={visibility}
                accessTier={accessTier}
                ownerSchoolId={ownerSchoolId}
                collapsed={collapsed}
                onToggleCollapse={onToggleCollapse}
                filters={filters}
                recipeIssues={recipeIssues}
              />
            </div>
          </div>
        </div>

        {/* Below 1400px it is a panel under the tree, spanning the tree's
            column: sticky is for a side pane, and a full-width block that
            follows the scroll would cover what it describes. */}
        <div className="min-[1000px]:col-start-2 min-[1400px]:col-start-3">
          <div
            aria-label={t('structure.inspectorTitle')}
            className="ssz-surface flex flex-col overflow-hidden rounded-2xl border border-border shadow-[var(--ssz-shadow-xs)] min-[1400px]:sticky min-[1400px]:top-[var(--structure-sticky-top,1rem)] min-[1400px]:max-h-[calc(100vh-3.5rem-var(--structure-sticky-top,1rem)-1rem)]"
          >
            <CurriculumInspector
              selection={selection}
              courseContainerId={containerId}
              workspaceId={workspaceId}
              onChanged={() => handleChanged()}
              onDelete={deletion.request}
            />
          </div>
        </div>

        {/* The inspector's footer deletes through the same confirmation the row
          menus use; the deleted node drops out of the selection by itself, as
          `handleChanged` re-resolves it against the reloaded tree. */}
        <DeleteNodeDialog
          target={deletion.target}
          onOpenChange={(open) => {
            if (!open) deletion.dismiss();
          }}
          onConfirm={deletion.confirm}
          pending={deletion.pending}
        />
      </div>
    </StructureUndoProvider>
  );
}

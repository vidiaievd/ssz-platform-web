'use client';

import { useTransition } from 'react';
import { Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { cn } from '@/lib/utils';
import type { CurriculumTree } from '@/features/content/types';

import { createSectionAction } from '../actions/section';
import { levelCollapseKey, levelDomId } from '../lib/structure-nodes';

interface OutlineRailProps {
  tree: CurriculumTree;
  /** The course's own container id — levels are sections on it. */
  courseContainerId: string;
  selectedId: string | null;
  /** Unfolds a level before scrolling to it; a jump into a collapsed level lands on nothing. */
  onExpand: (collapseKey: string) => void;
  onSelectLevel: (levelId: string | null) => void;
  /** Called after a level is created, so the caller can refetch and select it. */
  onChanged: (selectId?: string, kind?: 'level' | 'module' | 'item') => void;
}

/**
 * Jump list for the course. The tree is far taller than a screen once a course
 * has a few levels, and scrolling it to find "Leksjon 7" is the single most
 * repeated motion in this editor.
 *
 * The dot marks a level holding something students cannot see. It is derived
 * from the same module publish states the metric strip and the publish dialog
 * count, so the three cannot disagree (BEHAVIOR.md §5.2).
 */
export function OutlineRail({
  tree,
  courseContainerId,
  selectedId,
  onExpand,
  onSelectLevel,
  onChanged,
}: OutlineRailProps) {
  const t = useTranslations('Authoring');
  const tErrors = useTranslations('Errors');
  const [isPending, startTransition] = useTransition();

  function handleAddLevel() {
    if (isPending) return;
    startTransition(async () => {
      const result = await createSectionAction(courseContainerId, t('structure.newLevelTitle'));
      if (!result.ok) {
        toast.error(tErrors(result.error.code));
        return;
      }
      onChanged(result.value.sectionId, 'level');
    });
  }

  return (
    <nav
      aria-label={t('outline.title')}
      className="ssz-surface sticky top-4 flex flex-col gap-2 rounded-2xl border border-border p-3"
    >
      <h2 className="px-1 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
        {t('outline.title')}
      </h2>

      {tree.levels.length === 0 ? (
        <p className="px-1 pb-1 text-xs text-muted-foreground">{t('outline.empty')}</p>
      ) : (
        <ul className="flex flex-col gap-0.5">
          {tree.levels.map((level, index) => {
            const hasUnpublished = level.modules.some((m) => m.publishState !== 'published');
            return (
              <li key={levelCollapseKey(level)}>
                <button
                  type="button"
                  onClick={() => {
                    onExpand(levelCollapseKey(level));
                    onSelectLevel(level.id);
                    document
                      .getElementById(levelDomId(level))
                      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    selectedId === level.id
                      ? 'bg-primary-100/60 dark:bg-primary-900/30'
                      : 'hover:bg-subtle',
                  )}
                >
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-muted text-[11px] font-extrabold text-muted-foreground">
                    {index + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-foreground">
                    {level.title}
                  </span>
                  {hasUnpublished && (
                    <span
                      className="size-1.5 shrink-0 rounded-full bg-warning-500"
                      aria-label={t('outline.hasUnpublished')}
                    />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <button
        type="button"
        disabled={isPending}
        onClick={handleAddLevel}
        className="flex items-center justify-center gap-1.5 rounded-md border border-dashed border-border-strong px-2 py-1.5 text-[13px] font-semibold text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
      >
        <Plus size={13} />
        {t('structure.addLevel')}
      </button>
    </nav>
  );
}

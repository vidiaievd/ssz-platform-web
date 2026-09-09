'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Settings } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import type { Container } from '@/features/content/types';

import type { PreflightResult, SchoolRole } from '../types';
import { useCurriculumTree } from '../api/use-curriculum-tree';
import { allCollapseKeys } from '../lib/structure-nodes';
import { CourseSettingsDrawer } from './course-settings-drawer';
import { CourseStructurePanel } from './course-structure-panel';
import { CoverageStrip } from './coverage-strip';
import { collectPublishRows } from '../lib/publish-rows';
import { deriveContainerState } from './container-state-badge';
import { ReviewPublishDialog } from './review-publish-dialog';
import { StructureMetrics } from './structure-metrics';
import { StructureTopbar } from './structure-topbar';

interface CourseEditorShellProps {
  container: Container;
  schoolSlug: string;
  schoolRole?: SchoolRole;
  preflightResult?: PreflightResult;
  /** Draft version id (always present — containers keep one draft version). Null only on fetch failure. */
  draftVersionId: string | null;
  /** Version number students currently see; null while the container has never been published. */
  publishedVersionNumber: number | null;
}

/**
 * Primary authoring surface for a course: the topbar, the curriculum tree and
 * the inspector, with the Overview/Tags/Sharing/Danger-zone panels relocated
 * into a settings drawer. Replaces `AuthoringContainerTabs`.
 *
 * Collapse state lives here rather than in the tree because "Expand all" and
 * "Collapse all" sit in the topbar, above the tree.
 */
export function CourseEditorShell({
  container,
  schoolSlug,
  schoolRole = 'owner',
  preflightResult,
  draftVersionId,
  publishedVersionNumber,
}: CourseEditorShellProps) {
  const t = useTranslations('Authoring');
  const searchParams = useSearchParams();
  const [settingsOpen, setSettingsOpen] = useState(false);
  // Opened straight from a lesson editor, which has no tree of its own to
  // review against and so links back here instead of publishing on its own.
  const [publishOpen, setPublishOpen] = useState(searchParams.get('publish') === '1');
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());

  // The topbar is sticky and its height changes with the viewport (the action
  // row wraps), so the sticky side panes cannot park below it on a fixed
  // offset without either overlapping or leaving a gap.
  const topbarRef = useRef<HTMLElement>(null);
  const [topbarHeight, setTopbarHeight] = useState(0);
  useEffect(() => {
    const el = topbarRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => setTopbarHeight(el.offsetHeight));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const { data: tree } = useCurriculumTree(container.id, draftVersionId);
  const pendingCount = collectPublishRows(tree, container.title).length;

  const handleExpand = useCallback((key: string) => {
    setCollapsed((prev) => {
      if (!prev.has(key)) return prev;
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  }, []);

  const handleToggleCollapse = useCallback((key: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (!next.delete(key)) next.add(key);
      return next;
    });
  }, []);

  return (
    <div
      className="space-y-4"
      style={{ '--structure-sticky-top': `${topbarHeight + 16}px` } as React.CSSProperties}
    >
      <StructureTopbar
        ref={topbarRef}
        title={container.title}
        coursesHref={`/school/${schoolSlug}/content`}
        state={deriveContainerState(container)}
        versionNumber={publishedVersionNumber}
        updatedAt={container.updatedAt}
        pendingCount={pendingCount}
        previewHref={
          container.containerType === 'course' ? `/student/courses/${container.id}` : null
        }
        reviewInboxHref={`/school/${schoolSlug}/review?course=${container.id}`}
        onExpandAll={() => setCollapsed(new Set())}
        onCollapseAll={() => setCollapsed(new Set(allCollapseKeys(tree)))}
        onReview={() => setPublishOpen(true)}
        settingsTrigger={
          <Button variant="outline" size="sm" onClick={() => setSettingsOpen(true)}>
            <Settings className="size-4" />
            {t('settings.trigger')}
          </Button>
        }
        metrics={<StructureMetrics tree={tree} unpublished={pendingCount} />}
      />

      <ReviewPublishDialog
        container={container}
        draftVersionId={draftVersionId}
        open={publishOpen}
        onOpenChange={setPublishOpen}
      />
      <CourseSettingsDrawer
        container={container}
        schoolRole={schoolRole}
        preflightResult={preflightResult}
        draftVersionId={draftVersionId}
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
      />

      {/* Under the counts and above the tree: the topbar says how big the course
          is, this says what it is made of. Drawn expanded rather than folded
          behind a toggle — a channel nothing trains is invisible in a panel
          nobody opens. */}
      <div className="rounded-xl border border-border bg-card p-4">
        <CoverageStrip containerId={container.id} />
      </div>

      {draftVersionId ? (
        <CourseStructurePanel
          containerId={container.id}
          versionId={draftVersionId}
          schoolSlug={schoolSlug}
          targetLanguage={container.targetLanguage}
          difficultyLevel={container.difficultyLevel}
          visibility={container.visibility}
          accessTier={container.accessTier}
          ownerSchoolId={container.ownerSchoolId}
          collapsed={collapsed}
          onToggleCollapse={handleToggleCollapse}
          onExpand={handleExpand}
          onReview={() => setPublishOpen(true)}
        />
      ) : (
        <p className="text-muted-foreground py-10 text-center text-sm">
          {t('structure.loadError')}
        </p>
      )}
    </div>
  );
}

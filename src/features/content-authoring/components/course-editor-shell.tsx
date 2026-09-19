'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Settings } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import type { Container } from '@/features/content/types';
import { usePathname, useRouter } from '@/lib/i18n/navigation';
import { wsHref } from '@/features/workspaces/lib/href';

import type { PreflightResult, SchoolRole } from '../types';
import { useCurriculumTree } from '../api/use-curriculum-tree';
import { allCollapseKeys } from '../lib/structure-nodes';
import { CourseSettingsDrawer } from './course-settings-drawer';
import { CourseStructurePanel } from './course-structure-panel';
import { CoverageResultGrid } from './coverage-result-grid';
import { CoverageStrip } from './coverage-strip';
import { AtomCoverageReport } from './atom-coverage-report';
import { collectPublishRows } from '../lib/publish-rows';
import { deriveContainerState } from './container-state-badge';
import { ReviewPublishDialog } from './review-publish-dialog';
import { StructureMetrics } from './structure-metrics';
import { StructureTopbar, type EditorView } from './structure-topbar';

interface CourseEditorShellProps {
  container: Container;
  workspaceId: string;
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
 * Two views, one route. The structure tree and the coverage report are tabs of
 * the same screen rather than two pages, because the header above them — the
 * counts and, later, the draft's zeroes — is the thing that makes either of
 * them readable, and a second route would give the two views two headers that
 * could disagree (plan 64, phase 0).
 *
 * Collapse state lives here rather than in the tree because "Expand all" and
 * "Collapse all" drive every node at once, and the shell is what owns every
 * node.
 */
export function CourseEditorShell({
  container,
  workspaceId,
  schoolRole = 'owner',
  preflightResult,
  draftVersionId,
  publishedVersionNumber,
}: CourseEditorShellProps) {
  const t = useTranslations('Authoring');
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [settingsOpen, setSettingsOpen] = useState(false);
  // Opened straight from a lesson editor, which has no tree of its own to
  // review against and so links back here instead of publishing on its own.
  const [publishOpen, setPublishOpen] = useState(searchParams.get('publish') === '1');
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());

  // The view is in the URL, not in state: a report worth sending someone is
  // worth linking to, and "open the full report" from inside the tree has to
  // be an ordinary link rather than a click that only works from here.
  const view: EditorView = searchParams.get('view') === 'coverage' ? 'coverage' : 'structure';

  const handleViewChange = useCallback(
    (next: EditorView) => {
      if (next === view) return;
      const params = new URLSearchParams(searchParams.toString());
      if (next === 'structure') params.delete('view');
      else params.set('view', next);
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
      // Instant rather than smooth: this is a change of screen, and animating
      // a scroll through a report the reader has not asked to see reads as the
      // page moving on its own.
      window.scrollTo({ top: 0, behavior: 'instant' });
    },
    [view, searchParams, router, pathname],
  );

  // The topbar is sticky and its height changes — with the viewport (the action
  // row wraps) and with the view (tabs and, from phase 1, the health strip) —
  // so the sticky side panes cannot park below it on a fixed offset without
  // either overlapping or leaving a gap.
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
        coursesHref={wsHref(workspaceId, 'content')}
        state={deriveContainerState(container)}
        versionNumber={publishedVersionNumber}
        updatedAt={container.updatedAt}
        pendingCount={pendingCount}
        previewHref={
          container.containerType === 'course' ? `/student/courses/${container.id}` : null
        }
        reviewInboxHref={wsHref(workspaceId, `review?course=${container.id}`)}
        view={view}
        onViewChange={handleViewChange}
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

      {view === 'coverage' ? (
        <div className="space-y-4">
          {/* What the course is made of, by the exercises it holds. Drawn
              expanded rather than folded behind a toggle — a channel nothing
              trains is invisible in a panel nobody opens. */}
          <div className="rounded-xl border border-border bg-card p-4">
            <CoverageStrip containerId={container.id} />
          </div>

          {/* The same question asked of the facts rather than of the exercises: the strip
              above says this course is 84% picking an answer off a list, and this says which
              twenty-six words that leaves untested. Beside it rather than inside it — one
              counts exercises and the other counts what they are about, and a reader who
              cannot tell which is which will trust neither. */}
          <div className="rounded-xl border border-border bg-card p-4">
            <AtomCoverageReport containerId={container.id} />
          </div>

          {/* And underneath it, the same course seen from the other end: what came of
              teaching it. A course, not a module — a module's results are the course's
              results sliced too thin to read, and the published version is what learners
              actually took. */}
          {container.containerType === 'course' && (
            <CoverageResultGrid containerId={container.id} />
          )}
        </div>
      ) : draftVersionId ? (
        <CourseStructurePanel
          containerId={container.id}
          versionId={draftVersionId}
          workspaceId={workspaceId}
          targetLanguage={container.targetLanguage}
          difficultyLevel={container.difficultyLevel}
          visibility={container.visibility}
          accessTier={container.accessTier}
          ownerSchoolId={container.ownerSchoolId}
          collapsed={collapsed}
          onToggleCollapse={handleToggleCollapse}
          onExpand={handleExpand}
          onExpandAll={() => setCollapsed(new Set())}
          onCollapseAll={() => setCollapsed(new Set(allCollapseKeys(tree)))}
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

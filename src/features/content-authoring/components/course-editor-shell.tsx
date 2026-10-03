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
import { CoverageView } from './coverage-view';
import { collectPublishRows } from '../lib/publish-rows';
import { filtersFromParams } from '../lib/structure-filters';
import type { HealthAnchor } from '../lib/health-signals';
import { deriveContainerState } from './container-state-badge';
import { ReviewPublishDialog } from './review-publish-dialog';
import { StructureHealthStrip } from './structure-health-strip';
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
  // Opened from the workspace recipe page's list of courses that differ (plan 65).
  const [settingsOpen, setSettingsOpen] = useState(searchParams.get('settings') === '1');
  // Opened straight from a lesson editor, which has no tree of its own to
  // review against and so links back here instead of publishing on its own.
  const [publishOpen, setPublishOpen] = useState(searchParams.get('publish') === '1');
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  // Which coverage card a health signal asked for, while the view is still
  // switching: the card is not mounted until it has. A ref rather than state —
  // nothing renders differently for it, it is a note for the next paint.
  const pendingAnchorRef = useRef<HealthAnchor | null>(null);

  // The view is in the URL, not in state: a report worth sending someone is
  // worth linking to, and "open the full report" from inside the tree has to
  // be an ordinary link rather than a click that only works from here.
  const view: EditorView = searchParams.get('view') === 'coverage' ? 'coverage' : 'structure';

  // A triage button in the report lands here with the tree already filtered to
  // the material its finding is about. Read once, on the way in: from then on
  // the toolbar owns the filters.
  const initialFilters = filtersFromParams(searchParams);

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

  // A signal asks for the Coverage tab and for one card on it. The switch goes
  // through the same handler the tabs use, so the URL stays the record of which
  // view is open; the scroll waits for the card to exist.
  const handleOpenCoverage = useCallback(
    (anchor: HealthAnchor) => {
      if (view === 'coverage') {
        document.getElementById(anchor)?.scrollIntoView({ block: 'start' });
        return;
      }
      pendingAnchorRef.current = anchor;
      handleViewChange('coverage');
    },
    [view, handleViewChange],
  );

  useEffect(() => {
    const anchor = pendingAnchorRef.current;
    if (view !== 'coverage' || !anchor) return;
    pendingAnchorRef.current = null;
    document.getElementById(anchor)?.scrollIntoView({ block: 'start' });
  }, [view]);

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
        healthStrip={
          view === 'structure' ? (
            <StructureHealthStrip containerId={container.id} onOpenCoverage={handleOpenCoverage} />
          ) : null
        }
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
        <CoverageView
          containerId={container.id}
          containerType={container.containerType}
          publishedVersionNumber={publishedVersionNumber}
        />
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
          initialFilters={initialFilters}
        />
      ) : (
        <p className="text-muted-foreground py-10 text-center text-sm">
          {t('structure.loadError')}
        </p>
      )}
    </div>
  );
}

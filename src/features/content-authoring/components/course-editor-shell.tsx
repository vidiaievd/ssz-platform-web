'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Settings, Upload } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import type { Container } from '@/features/content/types';

import type { PreflightResult, SchoolRole } from '../types';
import { useCurriculumTree } from '../api/use-curriculum-tree';
import { CourseSettingsDrawer } from './course-settings-drawer';
import { CourseStructurePanel } from './course-structure-panel';
import { collectPublishRows } from '../lib/publish-rows';
import { ReviewPublishDialog } from './review-publish-dialog';

interface CourseEditorShellProps {
  container: Container;
  schoolSlug: string;
  schoolRole?: SchoolRole;
  preflightResult?: PreflightResult;
  /** Draft version id (always present — containers keep one draft version). Null only on fetch failure. */
  draftVersionId: string | null;
}

/**
 * Primary authoring surface for a course: the curriculum tree + inspector,
 * with the Overview/Tags/Sharing/Danger-zone panels relocated into a
 * settings drawer (opened from the header). Replaces `AuthoringContainerTabs`.
 */
export function CourseEditorShell({
  container,
  schoolSlug,
  schoolRole = 'owner',
  preflightResult,
  draftVersionId,
}: CourseEditorShellProps) {
  const t = useTranslations('Authoring');
  const searchParams = useSearchParams();
  const [settingsOpen, setSettingsOpen] = useState(false);
  // Opened straight from a lesson editor, which has no tree of its own to
  // review against and so links back here instead of publishing on its own.
  const [publishOpen, setPublishOpen] = useState(searchParams.get('publish') === '1');

  const { data: tree } = useCurriculumTree(container.id, draftVersionId);
  const pendingCount = collectPublishRows(tree, container.title).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end gap-1.5">
        <Button variant="outline" size="sm" onClick={() => setPublishOpen(true)}>
          <Upload className="size-4" />
          {t('reviewPublish.trigger')}
          {pendingCount > 0 && (
            <span className="ml-1 rounded-full bg-warning-100 px-1.5 text-[11px] font-bold text-warning-700">
              {pendingCount}
            </span>
          )}
        </Button>
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
          trigger={
            <Button variant="ghost" size="sm">
              <Settings className="size-4" />
              {t('settings.trigger')}
            </Button>
          }
        />
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
        />
      ) : (
        <p className="text-muted-foreground py-10 text-center text-sm">
          {t('structure.loadError')}
        </p>
      )}
    </div>
  );
}

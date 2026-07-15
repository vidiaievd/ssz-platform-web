'use client';

import { useState } from 'react';
import { Settings } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import type { Container } from '@/features/content/types';

import type { PreflightResult, SchoolRole } from '../types';
import { CourseSettingsDrawer } from './course-settings-drawer';
import { CourseStructurePanel } from './course-structure-panel';

interface CourseEditorShellProps {
  container: Container;
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
  schoolRole = 'owner',
  preflightResult,
  draftVersionId,
}: CourseEditorShellProps) {
  const t = useTranslations('Authoring');
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <CourseSettingsDrawer
          container={container}
          schoolRole={schoolRole}
          preflightResult={preflightResult}
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
          targetLanguage={container.targetLanguage}
          difficultyLevel={container.difficultyLevel}
          visibility={container.visibility}
          accessTier={container.accessTier}
        />
      ) : (
        <p className="text-muted-foreground py-10 text-center text-sm">
          {t('structure.loadError')}
        </p>
      )}
    </div>
  );
}

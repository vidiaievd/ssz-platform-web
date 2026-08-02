'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { Container } from '@/features/content/types';

import type { PreflightResult, SchoolRole } from '../types';
import { deriveContainerState } from './container-state-badge';
import { ContainerForm } from './container-form';
import { CoursePublishBlock } from './course-publish-block';
import { DangerZone } from './danger-zone';
import { SharingPanel } from './sharing-panel';
import { TagInput } from './tag-input';

type SettingsTab = 'overview' | 'tags' | 'sharing';

interface CourseSettingsDrawerProps {
  container: Container;
  schoolRole?: SchoolRole;
  preflightResult?: PreflightResult;
  /** Draft version id, shared with the structure panel so both read one tree query. */
  draftVersionId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Optional trigger element rendered via SheetTrigger (e.g. a "Settings" menu item). */
  trigger?: React.ReactNode;
}

/**
 * Consolidates the container's Overview / Tags / Sharing / Danger-zone panels
 * (previously separate tabs) into a slide-over, opened from the structure
 * editor's "More" menu — the curriculum tree is now the primary surface.
 */
export function CourseSettingsDrawer({
  container,
  schoolRole = 'owner',
  preflightResult,
  draftVersionId,
  open,
  onOpenChange,
  trigger,
}: CourseSettingsDrawerProps) {
  const t = useTranslations('Authoring');
  const state = deriveContainerState(container);
  const isOwnerOrAdmin = schoolRole === 'owner' || schoolRole === 'admin';
  const [tab, setTab] = useState<SettingsTab>('overview');

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {trigger && <SheetTrigger asChild>{trigger}</SheetTrigger>}
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{t('settings.title')}</SheetTitle>
          <SheetDescription>{t('settings.description')}</SheetDescription>
        </SheetHeader>

        <div className="px-4 pb-4">
          <Tabs value={tab} onValueChange={(v) => setTab(v as SettingsTab)}>
            <TabsList className="w-full">
              <TabsTrigger value={'overview' satisfies SettingsTab}>
                {t('tabs.overview')}
              </TabsTrigger>
              <TabsTrigger value={'tags' satisfies SettingsTab}>{t('tabs.tags')}</TabsTrigger>
              <TabsTrigger value={'sharing' satisfies SettingsTab}>{t('tabs.sharing')}</TabsTrigger>
            </TabsList>

            <TabsContent value={'overview' satisfies SettingsTab} className="space-y-6">
              <ContainerForm mode="edit" container={container} />
              <CoursePublishBlock
                container={container}
                draftVersionId={draftVersionId}
                preflightResult={preflightResult}
              />
              {isOwnerOrAdmin && (
                <DangerZone
                  containerId={container.id}
                  containerTitle={container.title}
                  state={state}
                  role={schoolRole}
                />
              )}
            </TabsContent>

            <TabsContent value={'tags' satisfies SettingsTab}>
              <TagInput entityType="container" entityId={container.id} />
            </TabsContent>

            <TabsContent value={'sharing' satisfies SettingsTab}>
              <SharingPanel entityType="container" entityId={container.id} />
            </TabsContent>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  );
}

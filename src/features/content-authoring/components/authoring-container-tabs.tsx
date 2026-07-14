'use client';

import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useRouter, usePathname } from '@/lib/i18n/navigation';
import type { Container } from '@/features/content/types';

import type { PreflightResult, SchoolRole } from '../types';
import { deriveContainerState } from './container-state-badge';
import { ContainerForm } from './container-form';
import { CourseStructurePanel } from './course-structure-panel';
import { DangerZone } from './danger-zone';
import { PreflightPanel } from './preflight-panel';
import { PublishDialog } from './publish-dialog';
import { SharingPanel } from './sharing-panel';
import { TagInput } from './tag-input';

type AuthoringTab = 'overview' | 'structure' | 'tags' | 'sharing';

interface AuthoringContainerTabsProps {
  container: Container;
  schoolRole?: SchoolRole;
  preflightResult?: PreflightResult;
  /** Draft version id (always present — containers keep one draft version). Null only on fetch failure. */
  draftVersionId: string | null;
}

export function AuthoringContainerTabs({
  container,
  schoolRole = 'owner',
  preflightResult,
  draftVersionId,
}: AuthoringContainerTabsProps) {
  const t = useTranslations('Authoring');
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const activeTab = (searchParams.get('tab') as AuthoringTab | null) ?? 'overview';
  const state = deriveContainerState(container);
  const isOwnerOrAdmin = schoolRole === 'owner' || schoolRole === 'admin';

  function handleTabChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', value);
    router.replace(`${pathname}?${params.toString()}` as never, { scroll: false });
  }

  return (
    <Tabs value={activeTab} onValueChange={handleTabChange}>
      <TabsList className="overflow-x-auto">
        <TabsTrigger value="overview">{t('tabs.overview')}</TabsTrigger>
        <TabsTrigger value="structure">{t('structure.sectionTitle')}</TabsTrigger>
        <TabsTrigger value="tags">{t('tabs.tags')}</TabsTrigger>
        <TabsTrigger value="sharing">{t('tabs.sharing')}</TabsTrigger>
      </TabsList>

      <TabsContent value="overview">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-4">
          {/* Left: edit form + publish action */}
          <div className="lg:col-span-2 space-y-6">
            <ContainerForm mode="edit" container={container} />
            {state === 'draft' && (
              <div className="border-t border-border pt-6">
                <PublishDialog container={container} />
              </div>
            )}
          </div>

          {/* Right: preflight panel (draft) + danger zone */}
          <div className="space-y-4">
            {state === 'draft' && (
              <PreflightPanel
                containerId={container.id}
                result={preflightResult}
              />
            )}
            {isOwnerOrAdmin && (
              <DangerZone
                containerId={container.id}
                containerTitle={container.title}
                state={state}
                role={schoolRole}
              />
            )}
          </div>
        </div>
      </TabsContent>

      <TabsContent value="structure">
        {draftVersionId ? (
          <CourseStructurePanel containerId={container.id} versionId={draftVersionId} />
        ) : (
          <p className="text-muted-foreground py-10 text-center text-sm">
            {t('structure.loadError')}
          </p>
        )}
      </TabsContent>
      <TabsContent value="tags">
        <TagInput entityType="container" entityId={container.id} />
      </TabsContent>
      <TabsContent value="sharing">
        <SharingPanel entityType="container" entityId={container.id} />
      </TabsContent>
    </Tabs>
  );
}

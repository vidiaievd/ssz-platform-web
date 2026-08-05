'use client';

import { useTransition } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { useRouter } from '@/lib/i18n/navigation';
import type { ContainerFormValues } from '../schemas/container';

import { createContainerAction } from '../actions/container';
import { syncStructureSectionsAction, listSectionsAction } from '../actions/section';
import { applyCefrStarterScaffoldAction } from '../actions/apply-starter-scaffold';
import { useCreateCourseStore, DEFAULT_CEFR_LEVELS } from '../stores/create-course';

/** Default visibility for newly-created courses — editable later via course settings. */
const DEFAULT_VISIBILITY: ContainerFormValues['visibility'] = 'private';
const DEFAULT_ACCESS_TIER: ContainerFormValues['accessTier'] = 'assigned_only';

/**
 * Shared "create the course" orchestration for both the guided wizard's last
 * step and the quick-create panel: creates the container, scaffolds CEFR
 * level sections (if `levelSystem === 'cefr'`), seeds the CEFR A1 starter
 * module (if `starter === 'cefr'`), then routes to the structure editor.
 */
export function useCreateCourseFlow() {
  const router = useRouter();
  const { schoolSlug } = useParams<{ schoolSlug: string }>();
  const t = useTranslations('Authoring.createCourse');
  const store = useCreateCourseStore();
  const [isPending, startTransition] = useTransition();

  const canCreate = store.basics.title.trim().length > 0;

  function create() {
    if (!canCreate || store.isCreating) return;
    store.setCreating(true);

    startTransition(async () => {
      const payload: ContainerFormValues = {
        title: store.basics.title.trim(),
        description: store.basics.description.trim() || undefined,
        containerType: 'course',
        targetLanguage: store.basics.targetLanguage || 'nb',
        difficultyLevel: 'A1',
        visibility: DEFAULT_VISIBILITY,
        accessTier: DEFAULT_ACCESS_TIER,
        levelSystem: store.levelSystem,
      };

      const containerResult = await createContainerAction(payload);
      if (!containerResult.ok) {
        store.setCreating(false);
        toast.error(t('createError'));
        return;
      }
      const containerId = containerResult.value.id;

      let firstLevelSectionId: string | null = null;
      if (store.levelSystem === 'cefr') {
        const syncResult = await syncStructureSectionsAction(containerId, DEFAULT_CEFR_LEVELS);
        if (syncResult.ok) {
          const sectionsResult = await listSectionsAction(containerId);
          if (sectionsResult.ok) {
            firstLevelSectionId = sectionsResult.value[0]?.id ?? null;
          }
        }
      }

      if (store.starter === 'cefr') {
        const starterResult = await applyCefrStarterScaffoldAction(
          containerId,
          payload.targetLanguage,
          payload.visibility,
          payload.accessTier,
          firstLevelSectionId,
          {
            module: t('starter.moduleTitle'),
            vocabulary: t('starter.vocabularyTitle'),
            reading: t('starter.readingTitle'),
            listening: t('starter.listeningTitle'),
            practice: t('starter.practiceTitle'),
            practiceInstructions: t('starter.practiceInstructions'),
          },
        );
        // Non-fatal: the course itself was created successfully, so the
        // author still lands in the editor and can add content manually.
        toast[starterResult.ok ? 'success' : 'error'](
          t(starterResult.ok ? 'createSuccess' : 'starterError'),
        );
      } else {
        toast.success(t('createSuccess'));
      }

      store.setCreating(false);
      store.reset();
      router.push(`/school/${schoolSlug}/content/${containerId}`);
    });
  }

  return { create, isCreating: store.isCreating || isPending, canCreate };
}

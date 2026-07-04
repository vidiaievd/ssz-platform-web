'use client';

import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { PlacementInlineCard } from '@/features/student/placement/placement-inline-card';
import type { PlacementModuleRow } from '@/features/student/placement/types';
import type { ContainerSection, ContainerItem } from '@/features/content/types';

interface CoursePlacementPromptProps {
  containerId: string;
  targetLanguage: string;
  modules?: PlacementModuleRow[];
  onModuleSelect?: (moduleIndex: number) => void;
}

export function CoursePlacementPrompt({
  containerId,
  targetLanguage,
  modules,
  onModuleSelect,
}: CoursePlacementPromptProps) {
  const t = useTranslations('Placement');

  async function handleResult(_placedLevelId: string, placedModuleIndex: number) {
    if (placedModuleIndex <= 1) return;

    try {
      const [sectionsRes, itemsRes] = await Promise.all([
        fetch(`/api/content/containers/${containerId}/sections`),
        fetch(`/api/content/containers/${containerId}/items`),
      ]);

      if (!sectionsRes.ok || !itemsRes.ok) return;

      const sections: ContainerSection[] = await sectionsRes.json();
      const items: ContainerItem[] = await itemsRes.json();

      // Rank sections by position; seed vocab from sections that come before the start module
      const sorted = [...sections].sort((a, b) => a.position - b.position);
      const beforeSectionIds = new Set(
        sorted.slice(0, placedModuleIndex - 1).map((s) => s.id),
      );

      if (beforeSectionIds.size === 0) return;

      const vocabListIds = items
        .filter((i) => i.itemType === 'vocabulary_list' && i.sectionId && beforeSectionIds.has(i.sectionId))
        .map((i) => i.itemId);

      if (vocabListIds.length === 0) return;

      await Promise.all(
        vocabListIds.map((vocabularyListId) =>
          fetch('/api/srs/cards/bulk-introduce', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ vocabularyListId, seedKind: 'DIAGNOSTIC_KNOWN' }),
          }),
        ),
      );

      toast.success(t('seed.success'));
    } catch {
      // Seeding is best-effort — silently ignore network failures
    }
  }

  return (
    <PlacementInlineCard
      containerId={containerId}
      targetLanguage={targetLanguage}
      modules={modules}
      onModuleSelect={onModuleSelect}
      onResult={handleResult}
    />
  );
}

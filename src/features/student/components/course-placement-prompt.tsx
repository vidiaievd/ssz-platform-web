'use client';

import { PlacementInlineCard } from '@/features/student/placement/placement-inline-card';
import type { PlacementModuleRow } from '@/features/student/placement/types';

interface CoursePlacementPromptProps {
  containerId: string;
  targetLanguage: string;
  modules?: PlacementModuleRow[];
  onModuleSelect?: (moduleIndex: number) => void;
}

/**
 * Inline dismissible placement card shown above the module list on the course
 * home page. Delegates all state and rendering to `PlacementInlineCard`.
 * Skip-known seeding on result is wired in F5.5.
 */
export function CoursePlacementPrompt({
  containerId,
  targetLanguage,
  modules,
  onModuleSelect,
}: CoursePlacementPromptProps) {
  return (
    <PlacementInlineCard
      containerId={containerId}
      targetLanguage={targetLanguage}
      modules={modules}
      onModuleSelect={onModuleSelect}
    />
  );
}

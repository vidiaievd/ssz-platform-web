'use client';

import type { Container, CurriculumTreeItemNode } from '@/features/content/types';
import { useRouter } from '@/lib/i18n/navigation';

import { LessonEditor } from './lesson-editor';

interface InterimEditorBodyProps {
  item: CurriculumTreeItemNode;
  /** The item's own module Container — every module is its own Container (see find-tree-item.ts). */
  moduleContainer: Container;
  backHref: string;
}

/**
 * Interim body for `LessonEditorShell` — only `live` still falls through here
 * (every other kind has a dedicated shell-native editor pane). FE2.6 replaces
 * this with a real live-stub editor.
 */
export function InterimEditorBody({ item, moduleContainer, backHref }: InterimEditorBodyProps) {
  const router = useRouter();
  const onClose = () => router.push(backHref);

  return (
    <LessonEditor
      lessonId={item.refId}
      lessonTitle={item.title ?? undefined}
      container={moduleContainer}
      onClose={onClose}
    />
  );
}

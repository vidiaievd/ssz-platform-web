'use client';

import type { Container, CurriculumTreeItemNode } from '@/features/content/types';
import { useRouter } from '@/lib/i18n/navigation';
import type { MaterialKind } from '@/lib/content/lesson-types';

import { LessonEditor } from './lesson-editor';
import { ExerciseEditor } from './exercise-editor';

interface InterimEditorBodyProps {
  kind: MaterialKind;
  item: CurriculumTreeItemNode;
  /** The item's own module Container — every module is its own Container (see find-tree-item.ts). */
  moduleContainer: Container;
  backHref: string;
}

/**
 * Dispatches to the pre-FE2 per-type editors (built for the old fixed-tabs UI)
 * as interim bodies for `LessonEditorShell`, so FE2.4–FE2.6 can each swap in a
 * dedicated shell-native editor one type at a time without blocking on the rest.
 */
export function InterimEditorBody({ kind, item, moduleContainer, backHref }: InterimEditorBodyProps) {
  const router = useRouter();
  const onClose = () => router.push(backHref);

  switch (kind) {
    case 'exercise':
      return <ExerciseEditor exerciseId={item.refId} container={moduleContainer} onClose={onClose} />;
    case 'text':
    case 'audio':
    case 'live':
    default:
      return (
        <LessonEditor
          lessonId={item.refId}
          lessonTitle={item.title ?? undefined}
          container={moduleContainer}
          onClose={onClose}
        />
      );
  }
}

import type { CurriculumTree, CurriculumTreeItemNode } from '@/features/content/types';

/** One exercise of a course, with enough of the tree around it to name it on screen. */
export interface CourseExerciseRef {
  /** The exercise itself — what an attempt in exercise-engine carries. */
  exerciseId: string;
  /** The row that places it, which is what the editor and queue URLs are built from. */
  itemId: string;
  title: string | null;
  levelTitle: string | null;
  moduleTitle: string | null;
  sectionTitle: string | null;
}

/**
 * Every exercise a course places, in reading order.
 *
 * The course inbox is built on this list: an attempt in exercise-engine knows its
 * exercise and nothing about courses, so "the submissions of this course" is a question
 * only answerable by walking the course's own tree first and asking about what is in it.
 * Walking it here also means one access check for the whole screen, against the course,
 * rather than one per exercise.
 *
 * An exercise placed twice appears once: the queue is keyed by exercise, and a second
 * entry would double every submission on the screen.
 */
export function collectCourseExercises(tree: CurriculumTree): CourseExerciseRef[] {
  const found = new Map<string, CourseExerciseRef>();

  const take = (
    item: CurriculumTreeItemNode,
    place: Omit<CourseExerciseRef, 'exerciseId' | 'itemId' | 'title'>,
  ) => {
    if (item.itemType !== 'exercise') return;
    if (found.has(item.refId)) return;
    found.set(item.refId, {
      exerciseId: item.refId,
      itemId: item.id,
      title: item.title,
      ...place,
    });
  };

  for (const level of tree.levels) {
    for (const mod of level.modules) {
      for (const section of mod.sections) {
        for (const item of section.items) {
          take(item, {
            levelTitle: level.title,
            moduleTitle: mod.title,
            sectionTitle: section.title,
          });
        }
      }
      for (const item of mod.ungroupedItems) {
        take(item, { levelTitle: level.title, moduleTitle: mod.title, sectionTitle: null });
      }
    }

    // Material attached to the edited container itself — a module keeps its own
    // exercises here, and this screen is opened on modules too.
    for (const item of level.items) {
      take(item, { levelTitle: null, moduleTitle: null, sectionTitle: level.title });
    }
  }

  for (const item of tree.ungroupedItems) {
    take(item, { levelTitle: null, moduleTitle: null, sectionTitle: null });
  }

  return [...found.values()];
}

import type { MySubmission } from '../types';

/**
 * Handing in a lesson is one act, and the list should say so.
 *
 * A learner working through a lesson submits every exercise in it, one after another —
 * twelve rows for one sitting, each repeating the same course and lesson, is a list about
 * the software rather than about them (BEHAVIOR §E). Runs of neighbours from the same
 * lesson become one heading with the exercises under it.
 *
 * Adjacency does the work: the list is newest first, so two submissions of the same lesson
 * are neighbours exactly when nothing else was handed in between them. The time window is
 * the second half of "one sitting" — the same lesson revisited a month later is a separate
 * piece of work, not a late row of the first one.
 */
const SAME_SITTING_MS = 12 * 60 * 60 * 1000;

export interface SubmissionGroup {
  /** Stable across renders: the first submission in the run is the run's identity. */
  key: string;
  course: string | null;
  lesson: string | null;
  items: MySubmission[];
}

export function groupByLesson(items: MySubmission[]): SubmissionGroup[] {
  const groups: SubmissionGroup[] = [];

  for (const item of items) {
    const last = groups.at(-1);
    if (last !== undefined && belongTogether(last, item)) {
      last.items.push(item);
      continue;
    }
    groups.push({
      key: item.id,
      course: item.course,
      lesson: item.lesson,
      items: [item],
    });
  }

  return groups;
}

/**
 * Same course, same lesson, one sitting.
 *
 * A submission whose lesson is unknown never joins anything: the snapshot is missing, not
 * empty, and folding two unknowns together would be claiming a lesson they share only in
 * having none.
 */
function belongTogether(group: SubmissionGroup, item: MySubmission): boolean {
  if (group.lesson === null || item.lesson === null) return false;
  if (group.lesson !== item.lesson || group.course !== item.course) return false;

  const previous = group.items.at(-1);
  if (previous === undefined) return false;

  const gap = Math.abs(
    new Date(previous.submittedAt).getTime() - new Date(item.submittedAt).getTime(),
  );
  return gap <= SAME_SITTING_MS;
}

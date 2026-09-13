import type { StudentListItem, StudentGroupRef } from '@/features/students/types';

export type RosterGroup = {
  id: string;
  name: string;
  lang: StudentGroupRef['lang'];
  level: StudentGroupRef['level'];
  scheduleSummary?: string;
  students: StudentListItem[];
};

export type RosterSplit = {
  /** Real groups the tutor made, each with its learners. */
  groups: RosterGroup[];
  /** Learners who are only in the workspace's own group — a lesson of one. */
  solo: StudentListItem[];
};

/**
 * Turns a flat roster into the two things a tutor reads: their small groups, and the
 * learners they teach one to one.
 *
 * Every learner belongs to the group the workspace keeps for itself — that is how they
 * reach the review queue at all — so that group carries no information on screen and is
 * skipped here by its `isDefault` flag (plan 59, §5.1). A learner in two real groups is
 * listed under both; a learner in none is solo.
 */
export function splitRosterByGroup(students: StudentListItem[]): RosterSplit {
  const groups = new Map<string, RosterGroup>();
  const solo: StudentListItem[] = [];

  for (const student of students) {
    const real = student.groups.filter((g) => !g.isDefault);
    if (real.length === 0) {
      solo.push(student);
      continue;
    }

    for (const ref of real) {
      const existing = groups.get(ref.id);
      if (existing) {
        existing.students.push(student);
        continue;
      }
      groups.set(ref.id, {
        id: ref.id,
        name: ref.name,
        lang: ref.lang,
        level: ref.level,
        scheduleSummary: ref.scheduleSummary,
        students: [student],
      });
    }
  }

  // A group of one is not a group. It is how a tutor's one-to-one lessons are kept — the
  // model has no other way to hang a lesson on a person (plan 62, §2 A) — and drawing it
  // as a group would put a fold in the roster around a single name.
  const real: RosterGroup[] = [];
  for (const group of groups.values()) {
    if (group.students.length === 1) solo.push(group.students[0]!);
    else real.push(group);
  }

  return {
    groups: real.sort((a, b) => a.name.localeCompare(b.name)),
    solo: solo.sort((a, b) => a.name.localeCompare(b.name)),
  };
}

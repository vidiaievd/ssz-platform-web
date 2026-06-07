/**
 * Single source of truth for student status derivation, clash detection,
 * teacher lineage, and segment predicates.
 * Used by: list page, detail page, dashboard at-risk widget, segments.
 */

import type {
  StudentStatus,
  StudentListItem,
  StudentGroupRef,
  TeacherRef,
  SegmentKey,
} from '@/features/students/types';

// ── Status priority: danger first ────────────────────────────────────────────

const STATUS_PRIORITY: Record<StudentStatus, number> = {
  clash: 0,
  unassigned: 1,
  'at-risk': 2,
  new: 3,
  finished: 4,
  active: 5,
};

export type StatusInput = {
  groups: StudentGroupRef[];
  clashes?: Array<{ groupA: string; groupB: string; day?: string; time?: string }>;
  progress: number;
  lastSeen: string | null;
  enrolledAt: string;
  /** Days of inactivity that trigger at-risk (default 14). */
  atRiskThresholdDays?: number;
  /** Days since enrollment that counts as "new" (default 7). */
  newThresholdDays?: number;
};

function daysSince(isoDate: string): number {
  const ms = Date.now() - new Date(isoDate).getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

export function deriveStatus(s: StatusInput): StudentStatus {
  const atRiskDays = s.atRiskThresholdDays ?? 14;
  const newDays = s.newThresholdDays ?? 7;

  const hasClash = (s.clashes?.length ?? 0) > 0;
  const isUnassigned = s.groups.length === 0;
  const isNew = daysSince(s.enrolledAt) <= newDays;
  const isFinished = s.progress >= 1;
  const isAtRisk =
    !isNew && s.lastSeen !== null && daysSince(s.lastSeen) >= atRiskDays;

  const candidates: StudentStatus[] = [];
  if (hasClash) candidates.push('clash');
  if (isUnassigned) candidates.push('unassigned');
  if (isAtRisk) candidates.push('at-risk');
  if (isNew) candidates.push('new');
  if (isFinished) candidates.push('finished');

  if (candidates.length === 0) return 'active';
  return candidates.reduce((best, c) =>
    STATUS_PRIORITY[c] < STATUS_PRIORITY[best] ? c : best,
  );
}

/** Distinct teachers across all groups, ordered primary → co-primary → substitute. */
export function studentTeachers(groups: StudentGroupRef[]): TeacherRef[] {
  const seen = new Set<string>();
  const result: TeacherRef[] = [];
  const roleOrder = { primary: 0, 'co-primary': 1, substitute: 2 };

  const all = groups
    .flatMap((g) => g.teachers ?? [])
    .sort((a, b) => roleOrder[a.role] - roleOrder[b.role]);

  for (const t of all) {
    if (!seen.has(t.userId)) {
      seen.add(t.userId);
      result.push(t);
    }
  }
  return result;
}

export type ClashPair = {
  groupA: string;
  groupB: string;
  day: string;
  time: string;
};

/**
 * Derive clash pairs from groups whose schedule summaries overlap.
 * Real implementation delegates to scheduling-service warnings coming from
 * the server; this pure function is used for client-side segment filtering.
 */
export function studentClashes(
  groups: StudentGroupRef[],
  serverClashes?: Array<{ groupA: string; groupB: string; day: string; time: string }>,
): ClashPair[] {
  if (serverClashes) return serverClashes;
  // Without scheduling data, cannot compute client-side — return empty.
  return [];
}

// ── Segment predicates ────────────────────────────────────────────────────────

export function segmentPredicate(key: SegmentKey): (s: StudentListItem) => boolean {
  switch (key) {
    case 'all':
      return () => true;
    case 'at-risk':
      return (s) => s.status === 'at-risk';
    case 'no-group':
      return (s) => s.status === 'unassigned' || s.groups.length === 0;
    case 'clash':
      return (s) => s.status === 'clash';
    case 'new':
      return (s) => s.status === 'new';
    case 'multi-group':
      return (s) => s.groups.length >= 2;
    case 'finished':
      return (s) => s.status === 'finished';
  }
}

export const SEGMENT_KEYS: SegmentKey[] = [
  'all',
  'at-risk',
  'no-group',
  'clash',
  'new',
  'multi-group',
  'finished',
];

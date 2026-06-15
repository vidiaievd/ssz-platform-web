import type { Group, Slot } from '@/features/groups/types';
import type { Membership } from '@/features/enrollment/types';

export interface GroupSuggestion {
  group: Group;
  /** 0 = exact match, 1 = one level away */
  levelDelta: number;
  /** How many of the student's availability prefs overlap with group slots */
  slotOverlap: number;
  hasCapacity: boolean;
}

const CEFR_ORDER = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;

function cefrDistance(a: string, b: string): number {
  const ai = CEFR_ORDER.indexOf(a as (typeof CEFR_ORDER)[number]);
  const bi = CEFR_ORDER.indexOf(b as (typeof CEFR_ORDER)[number]);
  if (ai === -1 || bi === -1) return 99;
  return Math.abs(ai - bi);
}

// Slot is a recurring block: day + start HH:MM + end HH:MM
// AvailabilityPref uses string day names and HH:MM ranges
function slotMatchesAvailability(
  slot: Slot,
  prefs: Membership['availability'],
): boolean {
  if (!prefs?.length) return false;
  return prefs.some((p) => {
    if (p.day !== slot.day) return false;
    // Overlap: pref.from < slot.end && slot.start < pref.to
    return p.from < slot.end && slot.start < p.to;
  });
}

/**
 * Suggests groups for a student membership, sorted by:
 *   1. level delta (exact match first)
 *   2. slot overlap (more overlap = better)
 *   3. groups with capacity
 *
 * Only groups matching the membership language and within 1 CEFR level are returned.
 */
export function suggestGroups(membership: Membership, groups: Group[]): GroupSuggestion[] {
  const cefrLevel = membership.placement?.cefrLevel;

  const candidates: GroupSuggestion[] = [];

  for (const group of groups) {
    if (group.lang !== membership.language) continue;
    if (group.status !== 'active') continue;

    const delta = cefrLevel ? cefrDistance(cefrLevel, group.level) : 0;
    if (delta > 1) continue;

    const hasCapacity = group.studentCount < group.capacity.max;

    const slotOverlap = membership.availability
      ? group.slots.filter((s) => slotMatchesAvailability(s, membership.availability)).length
      : 0;

    candidates.push({ group, levelDelta: delta, slotOverlap, hasCapacity });
  }

  // Sort: exact level > slot overlap > has capacity
  candidates.sort((a, b) => {
    if (a.levelDelta !== b.levelDelta) return a.levelDelta - b.levelDelta;
    if (b.slotOverlap !== a.slotOverlap) return b.slotOverlap - a.slotOverlap;
    return Number(b.hasCapacity) - Number(a.hasCapacity);
  });

  return candidates;
}

import type { PreflightCheck } from '../types';

export interface CheckGroup {
  ruleCode: string;
  /** Every check in the group, in the order pre-flight reported them. */
  checks: PreflightCheck[];
  /**
   * The single check, when the group holds exactly one. A lone warning can be
   * named and linked like a blocker; twenty-six of the same rule cannot.
   */
  only: PreflightCheck | null;
}

/**
 * Collapses checks by rule, preserving first-seen order.
 *
 * A module's warnings are dominated by one rule repeated per item — 26
 * VOCAB_NO_AUDIO in the dev database — and listing them one by one buries the
 * two that are about something else.
 */
export function groupChecksByRule(checks: PreflightCheck[]): CheckGroup[] {
  const groups = new Map<string, PreflightCheck[]>();

  for (const check of checks) {
    const bucket = groups.get(check.ruleCode) ?? [];
    bucket.push(check);
    groups.set(check.ruleCode, bucket);
  }

  return [...groups.entries()].map(([ruleCode, grouped]) => ({
    ruleCode,
    checks: grouped,
    only: grouped.length === 1 ? (grouped[0] as PreflightCheck) : null,
  }));
}

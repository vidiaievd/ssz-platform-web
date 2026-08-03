import type { CheckSeverity, PreflightCheck } from '../types';

export interface RuleViolation {
  ruleCode: string;
  severity: 'blocker' | 'warning';
  itemType: string;
  itemId: string;
  detail: string;
}

/**
 * Every item type that has an editor reachable by container-item route gets a
 * precise jump. `v.itemId` is the *content* id (the exercise, the lesson), not
 * the id of the row placing it — `findItemWithModule` falls back to `refId` for
 * exactly this reason.
 *
 * The remaining cases (version- and section-level rules) point at the container
 * page. That is the page the author is usually already on, so it reads as a
 * dead link; `null` is more honest and lets the UI omit the affordance.
 */
const ITEM_ROUTE_TYPES = new Set(['LESSON', 'EXERCISE', 'VOCABULARY_LIST', 'GRAMMAR_RULE']);

function resolveFixDeepLink(
  v: RuleViolation,
  ctx: { schoolSlug: string; containerId: string },
): string | null {
  const containerBase = `/school/${ctx.schoolSlug}/content/${ctx.containerId}`;

  if (ITEM_ROUTE_TYPES.has(v.itemType)) {
    return `${containerBase}/lessons/${v.itemId}`;
  }
  if (v.itemType === 'CONTAINER' && v.ruleCode === 'MODULE_EMPTY') {
    return `/school/${ctx.schoolSlug}/content/${v.itemId}`;
  }
  return null;
}

export interface MapViolationContext {
  schoolSlug: string;
  containerId: string;
  /**
   * Display title per content id, from the version's items. Rules that name
   * something the version does not place — a vocabulary *word*, a section, the
   * version itself — simply miss, and the check stays unnamed.
   */
  itemTitles?: Map<string, string | null>;
}

export function mapPreflightViolation(v: RuleViolation, ctx: MapViolationContext): PreflightCheck {
  return {
    id: `${v.ruleCode}:${v.itemId}`,
    severity: v.severity as CheckSeverity,
    ruleCode: v.ruleCode,
    itemTitle: ctx.itemTitles?.get(v.itemId) ?? null,
    detail: v.detail,
    fixDeepLink: resolveFixDeepLink(v, ctx),
  };
}

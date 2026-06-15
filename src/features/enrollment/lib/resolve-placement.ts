import type { PlacementResult, SchoolOnboardingSettings } from '@/features/enrollment/types';
import type { ISODate, LangCode } from '@/features/groups/types';
import { canReusePlatform } from '@/lib/enrollment/status';

export type PlacementDecision =
  | { action: 'reuse'; result: PlacementResult }
  | { action: 'take-school' }
  | { action: 'take-platform' }
  | { action: 'skip' };

/**
 * Determines what the student should do for placement at a given school.
 *
 * Rules:
 * - mode='none' → skip
 * - mode='platform' + reuse + fresh result → reuse
 * - mode='platform' + !reuse or stale → take-platform
 * - mode='school' → take-school (school-specific test, result scope='membership')
 */
export function resolvePlacement(
  platformResults: PlacementResult[],
  language: LangCode,
  settings: SchoolOnboardingSettings,
  now: ISODate,
): PlacementDecision {
  const { mode } = settings.placement;

  if (mode === 'none') return { action: 'skip' };

  const platformResult = platformResults.find(
    (p) => p.language === language && p.scope === 'platform',
  );

  if (mode === 'school') return { action: 'take-school' };

  // mode === 'platform'
  if (canReusePlatform(platformResult, settings, now)) {
    return { action: 'reuse', result: platformResult! };
  }

  return { action: 'take-platform' };
}

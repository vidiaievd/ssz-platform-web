import type {
  MembershipStatus,
  Membership,
  PlacementResult,
  SchoolOnboardingSettings,
} from '@/features/enrollment/types';
import type { ISODate } from '@/features/groups/types';

export type OnboardingStep = 'placement' | 'availability' | 'ageBand' | 'interview';

/** Returns the ordered list of onboarding steps required by these settings. */
export function onboardingSteps(s: SchoolOnboardingSettings): OnboardingStep[] {
  const steps: OnboardingStep[] = [];
  if (s.placement.mode !== 'none') steps.push('placement');
  if (s.availability.collect) steps.push('availability');
  if (s.ageBands.collect) steps.push('ageBand');
  if (s.interview.required) steps.push('interview');
  return steps;
}

const ALLOWED_TRANSITIONS: Record<MembershipStatus, MembershipStatus[]> = {
  pending: ['onboarding', 'rejected'],
  onboarding: ['placement-review', 'active'],
  'placement-review': ['active', 'rejected'],
  active: ['left'],
  rejected: [],
  left: [],
};

/** Pure guard — same logic used by BFF to re-validate transitions. */
export function canTransition(from: MembershipStatus, to: MembershipStatus): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Derives the next status after onboarding steps are complete.
 * - autoPlaceByScore && !required → skip PLACEMENT_REVIEW → active
 * - interview required → placement-review (school admin assigns group)
 * - approval auto → active
 */
export function resolveNextStatus(
  _m: Membership,
  s: SchoolOnboardingSettings,
): MembershipStatus {
  if (s.interview.required) return 'placement-review';
  if (s.interview.autoPlaceByScore) return 'active';
  return 'active';
}

/** True when platform placement result is fresh enough to reuse for a school. */
export function canReusePlatform(
  p: PlacementResult | undefined,
  s: SchoolOnboardingSettings,
  now: ISODate,
): boolean {
  if (!s.placement.reusePlatformResult) return false;
  if (!p) return false;
  if (!s.placement.maxResultAgeDays) return true;
  const takenMs = new Date(p.takenAt).getTime();
  const nowMs = new Date(now).getTime();
  const ageDays = (nowMs - takenMs) / (1000 * 60 * 60 * 24);
  return ageDays <= s.placement.maxResultAgeDays;
}

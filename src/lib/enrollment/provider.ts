import type {
  StudentProfile,
  SchoolOnboardingSettings,
  Membership,
  MembershipStatus,
  MembershipSource,
  PlacementResult,
  AvailabilityPref,
} from '@/features/enrollment/types';
import type { LangCode } from '@/features/groups/types';

export interface EnrollmentProvider {
  // ── Student profile ────────────────────────────────────────────────────────
  getProfile(accountId: string): Promise<StudentProfile>;

  // ── School settings ────────────────────────────────────────────────────────
  getSchoolSettings(schoolSlug: string): Promise<SchoolOnboardingSettings>;
  saveSchoolSettings(schoolSlug: string, settings: SchoolOnboardingSettings): Promise<SchoolOnboardingSettings>;

  // ── Membership lifecycle ───────────────────────────────────────────────────
  createMembership(input: {
    schoolSlug: string;
    source: MembershipSource;
    language: LangCode;
  }): Promise<Membership>;

  submitPlacement(membershipId: string, result: PlacementResult): Promise<Membership>;
  submitAvailability(membershipId: string, prefs: AvailabilityPref[]): Promise<Membership>;
  transition(membershipId: string, to: MembershipStatus): Promise<Membership>;

  /** Assigns student to a group and moves membership → active. */
  assignToGroup(membershipId: string, groupId: string): Promise<Membership>;

  // ── School-admin queues ────────────────────────────────────────────────────
  listPlacementQueue(schoolSlug: string): Promise<Membership[]>;
  listPendingApprovals(schoolSlug: string): Promise<Membership[]>;
}

// ── Singleton resolution ─────────────────────────────────────────────────────

let _instance: EnrollmentProvider | null = null;

export function getEnrollmentProvider(): EnrollmentProvider {
  if (_instance) return _instance;
  // Lazy import to avoid bundling mock in production builds
  if (process.env.ENROLLMENT_BACKEND === 'real') {
    throw new Error('Real enrollment provider not implemented yet. Set ENROLLMENT_BACKEND=mock.');
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { mockProvider } = require('./mock') as { mockProvider: EnrollmentProvider };
  _instance = mockProvider;
  return _instance;
}

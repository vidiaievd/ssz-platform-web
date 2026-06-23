import type { DifficultyLevel } from '@/features/content/types';
import type { SchoolType } from '@/features/discovery/types';
import type { CEFR, LangCode, ISODate, AgeBand } from '@/features/groups/types';

// ── Legacy enrollment-request types (existing school-side flow) ─────────────
export type EnrollmentStatus = 'pending' | 'approved' | 'rejected';

export interface EnrollmentRequest {
  id: string;
  schoolId: string;
  schoolName: string;
  schoolType: SchoolType;
  message?: string;
  selfAssessedLevel?: DifficultyLevel;
  status: EnrollmentStatus;
  createdAt: string;
  updatedAt: string;
  reviewedAt?: string;
  reviewNote?: string;
}

export interface EnrollmentRequestsResponse {
  items: EnrollmentRequest[];
}

// ── New enrollment model (identity ≠ membership, 0..N schools per student) ──

export type MembershipStatus =
  | 'pending'
  | 'onboarding'
  | 'placement-review'
  | 'active'
  | 'rejected'
  | 'left';

export type MembershipSource = 'public-apply' | 'invite' | 'direct';
export type PlacementMode = 'platform' | 'school' | 'none';
export type PlacementScope = 'platform' | 'membership';

export interface PlacementResult {
  language: LangCode;
  cefrLevel: CEFR;
  score: number;
  takenAt: ISODate;
  scope: PlacementScope;
  /** 'platform' or 'school:<slug>' */
  sourceLabel: string;
}

export interface AvailabilityPref {
  day: string;
  from: string;
  to: string;
}

export interface Membership {
  id: string;
  /** Backend UUID — present after membership is created via the real backend. */
  schoolId?: string;
  schoolSlug: string;
  schoolName: string;
  status: MembershipStatus;
  source: MembershipSource;
  language: LangCode;
  /** scope='membership' — present only if school required its own placement test */
  placement?: PlacementResult;
  availability?: AvailabilityPref[];
  ageBand?: AgeBand | null;
  groupId?: string;
  createdAt: ISODate;
}

export interface StudentProfile {
  accountId: string;
  /** Seam for minors — always null currently (adults-only) */
  guardianAccountId: string | null;
  /** Collected now to avoid backfill later; used by assertAdult */
  dateOfBirth?: ISODate;
  languagesOfInterest: LangCode[];
  /** scope='platform', one per language; feeds recommendations for all users */
  placement: PlacementResult[];
  memberships: Membership[];
}

export interface SchoolOnboardingSettings {
  placement: {
    mode: PlacementMode;
    schoolTestId?: string;
    reusePlatformResult: boolean;
    /** Freshness window for reuse; undefined = no limit */
    maxResultAgeDays?: number;
  };
  interview: {
    required: boolean;
    /** When !required && true: auto-assign by score without PLACEMENT_REVIEW */
    autoPlaceByScore: boolean;
  };
  availability: { collect: boolean };
  ageBands: { values: AgeBand[]; collect: boolean };
  approval: { mode: 'auto' | 'manual' };
}

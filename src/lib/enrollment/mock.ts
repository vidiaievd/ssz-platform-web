import { AppError } from '@/lib/errors/app-error';
import type {
  StudentProfile,
  Membership,
  MembershipStatus,
  MembershipSource,
  PlacementResult,
  AvailabilityPref,
  SchoolOnboardingSettings,
} from '@/features/enrollment/types';
import type { LangCode } from '@/features/groups/types';
import type { EnrollmentProvider } from './provider';
import { canTransition, resolveNextStatus } from './status';
import { resolveOnboardingSettings } from './settings-defaults';

// ── Fixture school settings ────────────────────────────────────────────────────

const FIXTURE_SETTINGS: Record<string, SchoolOnboardingSettings> = {
  'oslo-language-school': resolveOnboardingSettings({
    placement: { mode: 'platform', reusePlatformResult: true },
    interview: { required: true, autoPlaceByScore: false },
  }),
  'open-school': resolveOnboardingSettings({
    placement: { mode: 'none', reusePlatformResult: false },
    interview: { required: false, autoPlaceByScore: false },
    availability: { collect: false },
    approval: { mode: 'auto' },
  }),
};

const DEFAULT_FIXTURE_SETTINGS: SchoolOnboardingSettings = resolveOnboardingSettings();

// ── Fixture student profiles ───────────────────────────────────────────────────

const FIXTURE_PROFILE: StudentProfile = {
  accountId: 'acc-fixture-1',
  guardianAccountId: null,
  dateOfBirth: '1995-03-15',
  languagesOfInterest: ['nb', 'en'],
  placement: [],
  memberships: [],
};

// ── In-memory state ────────────────────────────────────────────────────────────

let membershipStore: Membership[] = [];
let idCounter = 1;

function nextId(): string {
  return `m${idCounter++}`;
}

function findMembership(id: string): Membership {
  const m = membershipStore.find((x) => x.id === id);
  if (!m) throw new AppError('not_found', `Membership ${id} not found`);
  return m;
}

// ── Mock provider ──────────────────────────────────────────────────────────────

export const mockProvider: EnrollmentProvider = {
  async getProfile(_accountId: string): Promise<StudentProfile> {
    return {
      ...FIXTURE_PROFILE,
      memberships: [...membershipStore],
    };
  },

  async getSchoolSettings(schoolSlug: string): Promise<SchoolOnboardingSettings> {
    return FIXTURE_SETTINGS[schoolSlug] ?? DEFAULT_FIXTURE_SETTINGS;
  },

  async createMembership(input: {
    schoolSlug: string;
    source: MembershipSource;
    language: LangCode;
  }): Promise<Membership> {
    const settings = await mockProvider.getSchoolSettings(input.schoolSlug);
    const initialStatus: MembershipStatus =
      settings.approval.mode === 'auto' ? 'onboarding' : 'pending';

    const membership: Membership = {
      id: nextId(),
      schoolSlug: input.schoolSlug,
      schoolName: input.schoolSlug.replace(/-/g, ' '),
      status: initialStatus,
      source: input.source,
      language: input.language,
      createdAt: new Date().toISOString().slice(0, 10),
    };
    membershipStore.push(membership);
    return { ...membership };
  },

  async submitPlacement(membershipId: string, result: PlacementResult): Promise<Membership> {
    const m = findMembership(membershipId);
    m.placement = result;
    return { ...m };
  },

  async submitAvailability(membershipId: string, prefs: AvailabilityPref[]): Promise<Membership> {
    const m = findMembership(membershipId);
    m.availability = prefs;
    return { ...m };
  },

  async transition(membershipId: string, to: MembershipStatus): Promise<Membership> {
    const m = findMembership(membershipId);
    if (!canTransition(m.status, to)) {
      throw new AppError(
        'conflict',
        `Transition ${m.status} → ${to} is not allowed`,
      );
    }
    m.status = to;
    return { ...m };
  },

  async assignToGroup(membershipId: string, groupId: string): Promise<Membership> {
    const m = findMembership(membershipId);
    const settings = await mockProvider.getSchoolSettings(m.schoolSlug);
    if (!canTransition(m.status, 'active')) {
      throw new AppError('conflict', `Cannot assign to group from status ${m.status}`);
    }
    m.groupId = groupId;
    m.status = resolveNextStatus(m, settings) === 'active' ? 'active' : 'active';
    return { ...m };
  },

  async listPlacementQueue(schoolSlug: string): Promise<Membership[]> {
    return membershipStore.filter(
      (m) => m.schoolSlug === schoolSlug && m.status === 'placement-review',
    );
  },

  async listPendingApprovals(schoolSlug: string): Promise<Membership[]> {
    return membershipStore.filter(
      (m) => m.schoolSlug === schoolSlug && m.status === 'pending',
    );
  },
};

/** Reset in-memory state — for use in tests only. */
export function resetMockStore(): void {
  membershipStore = [];
  idCounter = 1;
}

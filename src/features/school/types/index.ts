export type SchoolRole =
  | 'OWNER'
  | 'ADMIN'
  | 'MANAGER'
  | 'CONTENT_ADMIN'
  | 'TEACHER'
  | 'SCHEDULER'
  | 'STUDENT';

export type SchoolMemberRecord = {
  userId: string;
  role?: SchoolRole;
  joinedAt?: string;
};

export type School = {
  id: string;
  name: string;
  slug?: string | null;
  description?: string | null;
  avatarUrl?: string | null;
  website?: string | null;
  contactEmail?: string | null;
  city?: string | null;
  /** 'ONLINE' | 'HYBRID' — from org-service SchoolResponseDto */
  type?: 'ONLINE' | 'HYBRID' | null;
  /** UUID of the school owner — used for per-school role derivation */
  ownerId?: string | null;
  /** Members list — present in school detail responses, may be absent in list responses */
  members?: SchoolMemberRecord[];
  /** Role of the currently authenticated user in this school — injected by org-service in list responses */
  myRole?: SchoolRole | null;
  /** Capabilities for MANAGER role; null for all other roles */
  myCapabilities?: string[] | null;
  createdAt: string;
  updatedAt: string;
};

export type SchoolMember = {
  userId: string;
  role: SchoolRole;
  joinedAt: string;
};

export type InvitationStatus = 'pending' | 'accepted' | 'expired';

export type Invitation = {
  id: string;
  email: string;
  role: Exclude<SchoolRole, 'OWNER'>;
  status: InvitationStatus;
  token: string;
  inviteUrl: string;
  expiresAt: string;
  deliveryStatus: string;
  createdAt: string;
};

export type NameAvailabilityResponse = {
  available: boolean;
  suggestions: string[];
};

export type SlugAvailabilityResponse = {
  available: boolean;
  suggestions: string[];
};

export type CreateSchoolBody = {
  name: string;
  slug?: string;
  description?: string;
  avatarUrl?: string;
  website?: string;
  contactEmail?: string;
  city?: string;
};

export type InviteMemberBody = {
  email: string;
  role: Exclude<SchoolRole, 'OWNER' | 'STUDENT'>;
};

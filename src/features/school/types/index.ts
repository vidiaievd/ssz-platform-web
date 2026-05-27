export type SchoolRole = 'OWNER' | 'ADMIN' | 'CONTENT_ADMIN' | 'TEACHER' | 'STUDENT';

export type School = {
  id: string;
  name: string;
  description?: string | null;
  avatarUrl?: string | null;
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

export type CreateSchoolBody = {
  name: string;
  description?: string;
  avatarUrl?: string;
};

export type InviteMemberBody = {
  email: string;
  role: Exclude<SchoolRole, 'OWNER'>;
};

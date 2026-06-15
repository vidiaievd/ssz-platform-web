export type Profile = {
  id: string;
  userId: string;
  handle: string | null;
  displayName: string;
  firstName: string | null;
  lastName: string | null;
  bio: string | null;
  avatarUrl: string | null;
  uiLocale: string;
  instructionLocales: string[];
  timezone: string;
  contactEmail: string | null;
  contactPhone: string | null;
  hasStudentProfile: boolean;
  hasTutorProfile: boolean;
  createdAt: string;
  updatedAt: string;
};

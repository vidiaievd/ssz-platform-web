export type Profile = {
  id: string;
  userId: string;
  handle: string | null;
  displayName: string;
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

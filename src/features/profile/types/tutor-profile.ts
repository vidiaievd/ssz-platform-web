export type TutorProfile = {
  id: string;
  userId: string;
  teachingLanguages: string[];
  hourlyRate: number | null;
  currency: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateTutorProfileInput = {
  teachingLanguages?: string[];
  hourlyRate?: number | null;
  currency?: string | null;
};

export type UpdateTutorProfileInput = CreateTutorProfileInput;

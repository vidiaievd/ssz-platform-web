export type StudentProfile = {
  id: string;
  userId: string;
  nativeLanguage: string | null;
  targetLanguages: string[];
  createdAt: string;
  updatedAt: string;
};

export type CreateStudentProfileInput = {
  nativeLanguage?: string | null;
  targetLanguages?: string[];
};

export type UpdateStudentProfileInput = CreateStudentProfileInput;

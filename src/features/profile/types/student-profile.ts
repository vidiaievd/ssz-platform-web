export type TargetLanguage = {
  code: string;
  level?: string;
};

export type StudentProfile = {
  id: string;
  userId: string;
  nativeLanguage: string | null;
  targetLanguages: TargetLanguage[];
  createdAt: string;
  updatedAt: string;
};

export type CreateStudentProfileInput = {
  nativeLanguage?: string | null;
  targetLanguages?: TargetLanguage[];
};

export type UpdateStudentProfileInput = CreateStudentProfileInput;

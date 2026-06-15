export type TeachingLanguage = {
  code: string;
  level: string;
};

export type TeachingProfile = {
  id: string;
  userId: string;
  languages: TeachingLanguage[];
  createdAt: string;
  updatedAt: string;
};

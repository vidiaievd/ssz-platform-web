import type { DifficultyLevel } from '@/features/content/types';

export type SchoolType = 'school' | 'tutor';

export interface School {
  id: string;
  name: string;
  slug: string;
  type: SchoolType;
  description?: string;
  targetLanguages: string[];
  levels: DifficultyLevel[];
  location?: string;
  country?: string;
  coverImageUrl?: string;
  containerCount: number;
  studentCount?: number;
  priceRangeMin?: number;
  priceRangeMax?: number;
  currency?: string;
  isFree: boolean;
}

export interface PageInfo {
  endCursor?: string;
  hasNextPage: boolean;
  total: number;
}

export interface SchoolsResponse {
  items: School[];
  pageInfo: PageInfo;
}

import type { DifficultyLevel } from '@/features/content/types';
import type { SchoolType } from '@/features/discovery/types';

export type EnrollmentStatus = 'pending' | 'approved' | 'rejected';

export interface EnrollmentRequest {
  id: string;
  schoolId: string;
  schoolName: string;
  schoolType: SchoolType;
  message?: string;
  selfAssessedLevel?: DifficultyLevel;
  status: EnrollmentStatus;
  createdAt: string;
  updatedAt: string;
  reviewedAt?: string;
  reviewNote?: string;
}

export interface EnrollmentRequestsResponse {
  items: EnrollmentRequest[];
}

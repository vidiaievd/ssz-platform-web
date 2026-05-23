import { NextResponse } from 'next/server';

import type { EnrollmentRequest, EnrollmentRequestsResponse } from '@/features/enrollment/types';

// Stub data until the Enrollment service is available.
export const MOCK_ENROLLMENT_REQUESTS: EnrollmentRequest[] = [
  {
    id: 'req-1',
    schoolId: '1',
    schoolName: 'Oslo Norsk Akademi',
    schoolType: 'school',
    message: 'I moved to Oslo six months ago and need to reach B1 for the citizenship test.',
    selfAssessedLevel: 'A2',
    status: 'pending',
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'req-2',
    schoolId: '5',
    schoolName: 'Anna Solberg — Norsk Tutor',
    schoolType: 'tutor',
    message: 'Looking for one-on-one sessions focused on speaking.',
    selfAssessedLevel: 'B1',
    status: 'approved',
    createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
    reviewedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
    reviewNote: 'Welcome! Your first session is this Friday.',
  },
  {
    id: 'req-3',
    schoolId: '3',
    schoolName: 'Kyiv English Hub',
    schoolType: 'school',
    status: 'rejected',
    createdAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 18 * 24 * 60 * 60 * 1000).toISOString(),
    reviewedAt: new Date(Date.now() - 18 * 24 * 60 * 60 * 1000).toISOString(),
    reviewNote: 'Our current cohort is full. Please reapply next term.',
  },
];

export async function GET() {
  const response: EnrollmentRequestsResponse = { items: MOCK_ENROLLMENT_REQUESTS };
  return NextResponse.json(response);
}

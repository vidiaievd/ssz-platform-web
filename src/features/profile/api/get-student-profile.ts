import 'server-only';

import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors';
import type { StudentProfile } from '../types';

export async function getStudentProfile(): Promise<StudentProfile | null> {
  try {
    return await serverFetch<StudentProfile>({
      service: 'profile',
      path: '/profiles/me/student',
    });
  } catch (e) {
    if (e instanceof AppError && (e.code === 'not_found' || e.code === 'unauthenticated')) {
      return null;
    }
    return null;
  }
}

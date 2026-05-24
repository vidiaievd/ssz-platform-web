import 'server-only';

import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors';
import type { TutorProfile } from '../types';

export async function getTutorProfile(): Promise<TutorProfile | null> {
  try {
    return await serverFetch<TutorProfile>({
      service: 'profile',
      path: '/api/v1/profiles/me/tutor',
    });
  } catch (e) {
    if (e instanceof AppError && (e.code === 'not_found' || e.code === 'unauthenticated')) {
      return null;
    }
    return null;
  }
}

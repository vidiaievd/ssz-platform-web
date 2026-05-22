import 'server-only';

import { serverFetch } from '@/lib/api/server-fetcher';
import { readAccessToken } from '@/lib/auth/cookies';
import type { Profile } from '../types';

export async function getMyProfile(): Promise<Profile | null> {
  const token = await readAccessToken();
  if (!token) return null;

  try {
    return await serverFetch<Profile>({
      service: 'profile',
      path: '/api/v1/profiles/me',
    });
  } catch {
    return null;
  }
}

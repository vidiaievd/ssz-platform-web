'use server';

import { serverFetch } from '@/lib/api/server-fetcher';
import { tryAction } from '@/lib/result';
import type { Profile } from '../types';

export async function removeAvatarAction() {
  return tryAction(async () =>
    serverFetch<Profile>({
      service: 'profile',
      path: '/profiles/me',
      method: 'PATCH',
      body: { avatarUrl: null },
    }),
  );
}

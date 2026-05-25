'use server';

import { z } from 'zod';

import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors';
import { tryAction } from '@/lib/result';
import type { Profile } from '../types';

const schema = z.object({ avatarUrl: z.string().url('Invalid URL') });

export async function updateAvatarAction(avatarUrl: string) {
  return tryAction(async () => {
    const parsed = schema.safeParse({ avatarUrl });
    if (!parsed.success) {
      throw new AppError('validation', 'Invalid avatar URL', parsed.error.flatten());
    }

    return await serverFetch<Profile>({
      service: 'profile',
      path: '/api/v1/profiles/me',
      method: 'PATCH',
      body: { avatarUrl: parsed.data.avatarUrl },
    });
  });
}

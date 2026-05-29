'use server';

import { AppError } from '@/lib/errors';
import { serverFetch } from '@/lib/api/server-fetcher';
import { tryAction } from '@/lib/result';
import type { RegisterResponse } from '@/lib/api/generated/schemas';
import { registerSchema } from '../schemas';
import type { RegisterInput } from '../schemas';

export async function registerAction(input: RegisterInput) {
  return tryAction(async () => {
    const parsed = registerSchema.safeParse(input);
    if (!parsed.success) {
      throw new AppError('validation', 'Invalid input', parsed.error.flatten((i) => i.message));
    }

    const { email, password, role } = parsed.data;

    const result = await serverFetch<RegisterResponse>({
      service: 'auth',
      path: '/auth/register',
      method: 'POST',
      body: { email, password, role: role ?? null },
      anonymous: true,
    });

    return { userId: result.userId, email: result.email };
  });
}

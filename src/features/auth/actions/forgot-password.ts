'use server';

import { AppError } from '@/lib/errors';
import { serverFetch } from '@/lib/api/server-fetcher';
import { tryAction } from '@/lib/result';
import { forgotPasswordSchema } from '../schemas';
import type { ForgotPasswordInput } from '../schemas';

export async function forgotPasswordAction(input: ForgotPasswordInput) {
  return tryAction(async () => {
    const parsed = forgotPasswordSchema.safeParse(input);
    if (!parsed.success) {
      throw new AppError('validation', 'Invalid input', parsed.error.flatten());
    }

    await serverFetch({
      service: 'auth',
      path: '/api/v1/auth/password/forgot',
      method: 'POST',
      body: { email: parsed.data.email },
      anonymous: true,
    });
  });
}

'use server';

import { AppError } from '@/lib/errors';
import { serverFetch } from '@/lib/api/server-fetcher';
import { tryAction } from '@/lib/result';
import { resetPasswordSchema } from '../schemas';
import type { ResetPasswordInput } from '../schemas';

export async function resetPasswordAction(input: ResetPasswordInput) {
  return tryAction(async () => {
    const parsed = resetPasswordSchema.safeParse(input);
    if (!parsed.success) {
      throw new AppError('validation', 'Invalid input', parsed.error.flatten());
    }

    await serverFetch({
      service: 'auth',
      path: '/api/v1/auth/password/reset',
      method: 'POST',
      body: { token: parsed.data.token, newPassword: parsed.data.password },
      anonymous: true,
    });
  });
}

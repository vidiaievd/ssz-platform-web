'use server';

import { AppError } from '@/lib/errors';
import { serverFetch } from '@/lib/api/server-fetcher';
import { tryAction } from '@/lib/result';

export async function verifyEmailConfirmAction(token: string) {
  return tryAction(async () => {
    if (!token) throw new AppError('validation', 'Token is required');

    await serverFetch({
      service: 'auth',
      path: '/api/v1/auth/email/verify/confirm',
      method: 'POST',
      body: { token },
      anonymous: true,
    });
  });
}

export async function resendVerificationAction() {
  return tryAction(async () => {
    await serverFetch({
      service: 'auth',
      path: '/api/v1/auth/email/verify/request',
      method: 'POST',
    });
  });
}

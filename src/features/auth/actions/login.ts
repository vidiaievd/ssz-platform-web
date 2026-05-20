'use server';

import { AppError, isAppError } from '@/lib/errors';
import { serverFetch } from '@/lib/api/server-fetcher';
import { writeAuthCookies } from '@/lib/auth/cookies';
import { tryAction } from '@/lib/result';
import type { AuthTokensResponse, UserRolesResponse } from '@/lib/api/generated/schemas';
import { loginSchema, mfaChallengeSchema } from '../schemas';
import type { LoginInput, MfaChallengeInput } from '../schemas';

export type LoginActionResult =
  | { stage: 'authenticated'; roles: string[] }
  | { stage: 'mfa'; mfaChallengeToken: string };

export async function loginAction(input: LoginInput) {
  return tryAction(async (): Promise<LoginActionResult> => {
    const parsed = loginSchema.safeParse(input);
    if (!parsed.success) {
      throw new AppError('validation', 'Invalid input', parsed.error.flatten());
    }

    let tokens: AuthTokensResponse;
    try {
      tokens = await serverFetch<AuthTokensResponse>({
        service: 'auth',
        path: '/api/v1/auth/login',
        method: 'POST',
        body: { email: parsed.data.email, password: parsed.data.password },
        anonymous: true,
      });
    } catch (e) {
      if (isAppError(e) && e.code === 'mfa_required') {
        const mfaChallengeToken = (e.details as Record<string, unknown> | null)?.mfaChallengeToken;
        if (typeof mfaChallengeToken === 'string') {
          return { stage: 'mfa', mfaChallengeToken };
        }
      }
      throw e;
    }

    return finishLogin(tokens);
  });
}

export async function mfaChallengeAction(input: MfaChallengeInput) {
  return tryAction(async () => {
    const parsed = mfaChallengeSchema.safeParse(input);
    if (!parsed.success) {
      throw new AppError('validation', 'Invalid input', parsed.error.flatten());
    }

    const tokens = await serverFetch<AuthTokensResponse>({
      service: 'auth',
      path: '/api/v1/auth/mfa/challenge',
      method: 'POST',
      body: { mfaChallengeToken: parsed.data.mfaChallengeToken, code: parsed.data.code },
      anonymous: true,
    });

    return finishLogin(tokens);
  });
}

async function finishLogin(tokens: AuthTokensResponse): Promise<{ stage: 'authenticated'; roles: string[] }> {
  await writeAuthCookies({
    accessToken: tokens.accessToken!,
    refreshToken: tokens.refreshToken!,
  });

  const rolesData = await serverFetch<UserRolesResponse>({
    service: 'auth',
    path: '/api/v1/auth/roles',
    anonymous: true,
    headers: { Authorization: `Bearer ${tokens.accessToken}` },
  });

  return { stage: 'authenticated', roles: rolesData.roles ?? [] };
}

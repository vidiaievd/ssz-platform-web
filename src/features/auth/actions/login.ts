'use server';

import { AppError, isAppError } from '@/lib/errors';
import { serverFetch } from '@/lib/api/server-fetcher';
import { writeAuthCookies } from '@/lib/auth/cookies';
import { decodeJwtPayload } from '@/lib/auth/decode-jwt';
import { tryAction } from '@/lib/result';
import type { AuthTokensResponse } from '@/lib/api/generated/schemas';
import { loginSchema, mfaChallengeSchema } from '../schemas';
import { authRefusalOf } from '../utils/auth-refusal';
import type { LoginInput, MfaChallengeInput } from '../schemas';

export type LoginActionResult =
  | {
      stage: 'authenticated';
      roles: string[];
      hasStudentProfile: boolean;
      hasTutorProfile: boolean;
      emailVerified?: boolean;
    }
  | { stage: 'mfa'; mfaChallengeToken: string }
  | { stage: 'email_not_verified' };

/** What `POST auth/login` answers: tokens, or a challenge when two-factor is on. */
type LoginResponse =
  | AuthTokensResponse
  | { mfaRequired: true; challenge: { mfaChallengeToken: string; expiresAt?: string } };

function isMfaChallenge(
  response: LoginResponse,
): response is Extract<LoginResponse, { mfaRequired: true }> {
  return (response as { mfaRequired?: unknown }).mfaRequired === true;
}

export async function loginAction(input: LoginInput) {
  return tryAction(async (): Promise<LoginActionResult> => {
    const parsed = loginSchema.safeParse(input);
    if (!parsed.success) {
      throw new AppError('validation', 'Invalid input', parsed.error.flatten((i) => i.message));
    }

    let response: LoginResponse;
    try {
      response = await serverFetch<LoginResponse>({
        service: 'auth',
        path: '/auth/login',
        method: 'POST',
        body: { email: parsed.data.email, password: parsed.data.password },
        anonymous: true,
      });
    } catch (e) {
      // Only this 403 means "confirm your email"; a blocked account (403 ACCOUNT_BLOCKED) and a
      // lockout (423 ACCOUNT_LOCKED) go back to the form as errors it names itself.
      if (isAppError(e) && authRefusalOf(e)?.kind === 'email_not_verified') {
        return { stage: 'email_not_verified' };
      }
      throw e;
    }

    // With two-factor on, auth answers 200 with a challenge instead of tokens.
    if (isMfaChallenge(response)) {
      return { stage: 'mfa', mfaChallengeToken: response.challenge.mfaChallengeToken };
    }

    return finishLogin(response);
  });
}

export async function mfaChallengeAction(input: MfaChallengeInput) {
  return tryAction(async () => {
    const parsed = mfaChallengeSchema.safeParse(input);
    if (!parsed.success) {
      throw new AppError('validation', 'Invalid input', parsed.error.flatten((i) => i.message));
    }

    const tokens = await serverFetch<AuthTokensResponse>({
      service: 'auth',
      path: '/auth/mfa/challenge',
      method: 'POST',
      body: { mfaChallengeToken: parsed.data.mfaChallengeToken, code: parsed.data.code },
      anonymous: true,
    });

    return finishLogin(tokens);
  });
}

async function finishLogin(tokens: AuthTokensResponse): Promise<LoginActionResult & { stage: 'authenticated' }> {
  await writeAuthCookies({
    accessToken: tokens.accessToken!,
    refreshToken: tokens.refreshToken!,
    accessTokenExpiresAt: tokens.accessTokenExpiresAt,
    refreshTokenExpiresAt: tokens.refreshTokenExpiresAt,
  });

  const authHeader = { Authorization: `Bearer ${tokens.accessToken}` };

  // Decode JWT payload to detect email_verified without an extra round-trip.
  const payload = decodeJwtPayload(tokens.accessToken!);
  const emailVerified =
    typeof payload?.email_verified === 'boolean' ? payload.email_verified : undefined;

  const [meResult, profileResult] = await Promise.allSettled([
    serverFetch<{ roles: string[] }>({
      service: 'auth',
      path: '/auth/me',
      anonymous: true,
      headers: authHeader,
    }),
    serverFetch<{ hasStudentProfile: boolean; hasTutorProfile: boolean }>({
      service: 'profile',
      path: '/profiles/me',
      anonymous: true,
      headers: authHeader,
    }),
  ]);

  const roles = meResult.status === 'fulfilled' ? (meResult.value.roles ?? []) : [];
  const hasStudentProfile =
    profileResult.status === 'fulfilled' ? profileResult.value.hasStudentProfile : false;
  const hasTutorProfile =
    profileResult.status === 'fulfilled' ? profileResult.value.hasTutorProfile : false;

  return { stage: 'authenticated', roles, hasStudentProfile, hasTutorProfile, emailVerified };
}

'use server';

import { AppError } from '@/lib/errors';
import { serverFetch } from '@/lib/api/server-fetcher';
import { writeAuthCookies, readPendingInvite, clearPendingInvite } from '@/lib/auth/cookies';
import { tryAction } from '@/lib/result';
import type { AuthTokensResponse } from '@/lib/api/generated/schemas';

export type VerifyEmailResult = {
  roles: string[];
  /** Set when a pending invite was auto-accepted; client should redirect here. */
  acceptedInviteRedirect?: string;
};

export async function verifyEmailConfirmAction(token: string) {
  return tryAction(async (): Promise<VerifyEmailResult> => {
    if (!token) throw new AppError('validation', 'Token is required');

    // Step 1: verify token
    const tokens = await serverFetch<AuthTokensResponse>({
      service: 'auth',
      path: '/auth/email/verify/confirm',
      method: 'POST',
      body: { token },
      anonymous: true,
    });

    // Step 2: write cookies
    await writeAuthCookies({
      accessToken: tokens.accessToken!,
      refreshToken: tokens.refreshToken!,
      accessTokenExpiresAt: tokens.accessTokenExpiresAt,
      refreshTokenExpiresAt: tokens.refreshTokenExpiresAt,
    });

    // Step 3: fetch roles
    const me = await serverFetch<{ roles: string[] }>({
      service: 'auth',
      path: '/auth/me',
      anonymous: true,
      headers: { Authorization: `Bearer ${tokens.accessToken}` },
    });
    const roles = me.roles ?? [];

    // Step 4: auto-accept pending invite (token survived email-link click via httpOnly cookie).
    const pendingInviteToken = await readPendingInvite();
    if (pendingInviteToken) {
      try {
        await serverFetch({
          service: 'organization',
          path: `/schools/invitations/${pendingInviteToken}/accept`,
          method: 'POST',
          headers: { Authorization: `Bearer ${tokens.accessToken}` },
        });
        await clearPendingInvite();
        // Redirect to workspace resolver — it will pick up the new school membership.
        return { roles, acceptedInviteRedirect: '/school' };
      } catch {
        // Accept failed (already accepted, revoked, expired) — clear cookie and proceed normally.
        await clearPendingInvite();
      }
    }

    return { roles };
  });
}

export async function resendVerificationAction() {
  return tryAction(async () => {
    await serverFetch({
      service: 'auth',
      path: '/auth/email/verify/request',
      method: 'POST',
    });
  });
}

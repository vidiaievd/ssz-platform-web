/**
 * Sign-in refusals auth-service names by code rather than by status alone: a blocked account
 * (403 `ACCOUNT_BLOCKED`, plan 90, phase 6) and a lockout after too many failed passwords or
 * codes (423 `ACCOUNT_LOCKED` with `lockedUntil`). Both arrive as an AppError whose `details`
 * is the auth-service problem body.
 */
export type AuthRefusal =
  | { kind: 'blocked' }
  | { kind: 'locked'; lockedUntil: string | null }
  | { kind: 'email_not_verified' }
  | { kind: 'invalid_code' };

type ErrorLike = { details?: unknown } | null | undefined;

function serverCode(details: unknown): string | null {
  if (details === null || typeof details !== 'object') return null;
  const code = (details as Record<string, unknown>).code;
  return typeof code === 'string' ? code : null;
}

/** The refusal the error stands for, or null when it is not one of the sign-in refusals. */
export function authRefusalOf(error: ErrorLike): AuthRefusal | null {
  const details = error?.details;
  switch (serverCode(details)) {
    case 'ACCOUNT_BLOCKED':
      return { kind: 'blocked' };
    case 'ACCOUNT_LOCKED': {
      const until = (details as Record<string, unknown>).lockedUntil;
      return { kind: 'locked', lockedUntil: typeof until === 'string' ? until : null };
    }
    case 'EMAIL_NOT_VERIFIED':
      return { kind: 'email_not_verified' };
    case 'INVALID_TOTP_CODE':
      return { kind: 'invalid_code' };
    default:
      return null;
  }
}

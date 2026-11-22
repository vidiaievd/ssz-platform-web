import type { EmailResolveResult } from '@/features/students/types';

/** Why an address could not be checked — shown on its row; the row is then left out of the enrolment. */
export class ResolveEmailError extends Error {
  constructor(readonly reason: 'rate_limited' | 'failed') {
    super(reason);
    this.name = 'ResolveEmailError';
  }
}

/**
 * Which branch an address takes in "Enroll student". A failure is thrown, never read as
 * `register`: the address may have an account, and a registration letter would then go to it.
 */
export async function resolveEmail(
  schoolId: string,
  email: string,
): Promise<EmailResolveResult> {
  const res = await fetch(
    `/api/schools/${schoolId}/students/resolve?email=${encodeURIComponent(email)}`,
    { method: 'GET' },
  );
  if (res.status === 429) throw new ResolveEmailError('rate_limited');
  if (!res.ok) throw new ResolveEmailError('failed');
  return res.json() as Promise<EmailResolveResult>;
}

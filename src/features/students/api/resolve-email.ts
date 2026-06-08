import type { EmailResolveResult } from '@/features/students/types';

export async function resolveEmail(
  schoolId: string,
  email: string,
): Promise<EmailResolveResult> {
  const res = await fetch(
    `/api/schools/${schoolId}/students/resolve?email=${encodeURIComponent(email)}`,
    { method: 'GET' },
  );
  if (!res.ok) {
    return { branch: 'register' };
  }
  return res.json() as Promise<EmailResolveResult>;
}

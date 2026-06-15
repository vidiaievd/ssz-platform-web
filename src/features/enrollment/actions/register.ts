'use server';

import { AppError } from '@/lib/errors';
import { tryAction } from '@/lib/result';
import { registerAction } from '@/features/auth/actions/register';
import { assertAdult } from '@/lib/enrollment/assert-adult';
import { getEnrollmentProvider } from '@/lib/enrollment/provider';
import { studentRegisterSchema } from '../schemas/register';
import type { StudentRegisterInput } from '../schemas/register';
import type { EntryIntent } from '@/lib/enrollment/intent';

export interface StudentRegisterResult {
  /** Where to redirect after registration. */
  redirectTo: string;
}

export async function studentRegisterAction(
  input: StudentRegisterInput,
  intent: EntryIntent,
): Promise<ReturnType<typeof tryAction<StudentRegisterResult>>> {
  return tryAction(async () => {
    const parsed = studentRegisterSchema.safeParse(input);
    if (!parsed.success) {
      throw new AppError('validation', 'Invalid input', parsed.error.flatten((i) => i.message));
    }

    // Adult checkpoint seam (no-op now; future: guardian flow for minors)
    assertAdult({ dateOfBirth: parsed.data.dateOfBirth });

    // Create the Account — identical across all three entry paths
    const authResult = await registerAction({
      email: parsed.data.email,
      password: parsed.data.password,
      passwordConfirm: parsed.data.passwordConfirm,
      acceptedTerms: parsed.data.acceptedTerms,
      role: 'student',
    });

    if (!authResult.ok) {
      throw new AppError(authResult.error.code, authResult.error.message, authResult.error.details);
    }

    // Branch by intent — Membership is additive, Account stays the same
    if (intent.kind === 'join_school') {
      const provider = getEnrollmentProvider();
      await provider.createMembership({
        schoolSlug: intent.schoolSlug,
        source: 'public-apply',
        language: 'nb', // TODO: derive from school's primary language in Phase 3
      });
      return { redirectTo: `/student/onboarding/${intent.schoolSlug}` };
    }

    if (intent.kind === 'invited') {
      const provider = getEnrollmentProvider();
      await provider.createMembership({
        schoolSlug: '', // resolved from token at the BFF; placeholder until backend exists
        source: 'invite',
        language: 'nb',
      });
      return { redirectTo: '/student' };
    }

    // explore — free student, no membership
    return { redirectTo: '/student' };
  });
}

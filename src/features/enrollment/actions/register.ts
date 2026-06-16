'use server';

import { AppError } from '@/lib/errors';
import { tryAction } from '@/lib/result';
import { registerAction } from '@/features/auth/actions/register';
import { assertAdult } from '@/lib/enrollment/assert-adult';
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

    // Create the account — identical across all entry paths
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

    // After registration the user must log in before membership can be created.
    // Redirect them to the appropriate starting point; the membership creation happens
    // via the apply CTA on the school page once they are authenticated.
    if (intent.kind === 'join_school') {
      return { redirectTo: `/s/${intent.schoolSlug}?registered=true` };
    }

    if (intent.kind === 'invited') {
      return { redirectTo: '/student' };
    }

    // explore — free student, no membership
    return { redirectTo: '/student' };
  });
}

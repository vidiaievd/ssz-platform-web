import { redirect } from 'next/navigation';
import { getLocale } from 'next-intl/server';

import { getWorkspaces } from '@/features/workspaces/api/get-workspaces';
import { STAFF_ROLES } from '@/features/workspaces/types';
import { getCurrentUser } from '@/features/auth/api/get-current-user';
import type { WorkspaceContext } from '@/features/workspaces/types';

function resolveContextUrl(
  key: string,
  contexts: WorkspaceContext[],
  locale: string,
  userId?: string,
): string | null {
  if (key.startsWith('school:')) {
    const schoolId = key.slice('school:'.length);
    const ctx = contexts.find((c) => c.type === 'school' && c.schoolId === schoolId);
    if (!ctx || ctx.type !== 'school') return null;
    return `/${locale}/school/${ctx.schoolSlug}/dashboard`;
  }
  if (key === 'private_tutor') {
    const ctx = contexts.find((c) => c.type === 'private_tutor');
    if (!ctx || ctx.type !== 'private_tutor') return null;
    return `/${locale}/tutor/${userId ?? ctx.tutorProfileId}/dashboard`;
  }
  if (key === 'student') {
    const ctx = contexts.find((c) => c.type === 'student');
    if (!ctx) return null;
    return `/${locale}/student/dashboard`;
  }
  return null;
}

export default async function SchoolIndexPage() {
  const locale = await getLocale();

  const workspaces = await getWorkspaces().catch(() => null);

  if (!workspaces) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center p-8 text-center">
        <p className="text-sm text-muted-foreground">
          Unable to load your workspaces. Please refresh or try again later.
        </p>
      </main>
    );
  }

  const { contexts, lastActiveContextKey } = workspaces;
  const user = await getCurrentUser();
  const userId = user?.userId;

  // Restore last active context if it still exists
  if (lastActiveContextKey) {
    const target = resolveContextUrl(lastActiveContextKey, contexts, locale, userId);
    if (target) redirect(target);
  }

  // Default priority: school (staff role) → private tutor → student
  const schoolCtx = contexts.find(
    (c) => c.type === 'school' && STAFF_ROLES.includes(c.role),
  );
  if (schoolCtx && schoolCtx.type === 'school') {
    redirect(`/${locale}/school/${schoolCtx.schoolSlug}/dashboard`);
  }

  const tutorCtx = contexts.find((c) => c.type === 'private_tutor');
  if (tutorCtx && tutorCtx.type === 'private_tutor') {
    redirect(`/${locale}/tutor/${userId ?? tutorCtx.tutorProfileId}/dashboard`);
  }

  const studentCtx = contexts.find((c) => c.type === 'student');
  if (studentCtx) {
    redirect(`/${locale}/student/dashboard`);
  }

  // No contexts — send to onboarding based on global roles
  const roles = user?.roles ?? [];
  if (roles.includes('school_admin')) {
    redirect(`/${locale}/onboarding/school`);
  }
  if (roles.includes('tutor')) {
    redirect(`/${locale}/onboarding/tutor`);
  }

  redirect(`/${locale}/student/dashboard`);
}

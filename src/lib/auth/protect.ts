import 'server-only';

import { notFound, redirect } from 'next/navigation';
import { getLocale } from 'next-intl/server';

import { getCurrentUser } from '@/features/auth/api/get-current-user';
import type { CurrentUser } from '@/features/auth/types/current-user';

/**
 * Returns the authenticated user, or redirects to /login.
 * Use in Server Components and Server Actions that require authentication.
 */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) {
    const locale = await getLocale();
    redirect(`/${locale}/login`);
  }
  return user;
}

/**
 * Returns the authenticated user if they have the given role, or 404.
 * Use to gate sections of the app to a specific role.
 */
export async function requireRole(role: string): Promise<CurrentUser> {
  const user = await requireUser();
  if (!user.roles.includes(role)) notFound();
  return user;
}

/**
 * Returns the authenticated user if they have any of the given roles, or 404.
 */
export async function requireAnyRole(roles: string[]): Promise<CurrentUser> {
  const user = await requireUser();
  if (!roles.some((r) => user.roles.includes(r))) notFound();
  return user;
}

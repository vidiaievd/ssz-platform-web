export function resolvePostLoginPath(
  auth: {
    roles: string[];
    hasStudentProfile: boolean;
    hasTutorProfile: boolean;
  },
  redirect?: string,
): string {
  if (redirect && redirect.startsWith('/') && !redirect.startsWith('//')) {
    return redirect;
  }
  // Single entry point: server-side workspace resolver (school/page.tsx)
  // handles context detection and onboarding fallbacks for all roles.
  return '/school';
}

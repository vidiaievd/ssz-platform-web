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
  if (auth.roles.includes('school_admin')) {
    return '/school';
  }
  if (auth.roles.includes('tutor')) {
    return auth.hasTutorProfile ? '/school' : '/onboarding?step=profile';
  }
  if (auth.roles.includes('student')) {
    return auth.hasStudentProfile ? '/student/dashboard' : '/onboarding?step=profile';
  }
  return '/student/dashboard';
}

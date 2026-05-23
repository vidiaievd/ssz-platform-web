import 'server-only';

/**
 * Returns active enrollment IDs for the current user.
 * Stub returns one approved enrollment so the enrolled dashboard is accessible in dev.
 * Replace with serverFetch({ service: 'enrollment', path: '/api/v1/enrollments/me' })
 * when the Enrollment service is available.
 */
export async function getEnrollmentStatus(): Promise<string[]> {
  return ['school-1'];
}

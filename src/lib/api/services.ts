import 'server-only';

import { env } from '@/lib/env';

export type ServiceName = 'auth' | 'profile' | 'content' | 'exercises' | 'progress' | 'enrollment' | 'media' | 'organization' | 'analytics' | 'notification' | 'scheduling';

const directUrls: Record<ServiceName, string | undefined> = {
  auth: env.AUTH_SERVICE_URL,
  profile: env.PROFILE_SERVICE_URL,
  content: env.CONTENT_SERVICE_URL,
  exercises: env.EXERCISE_SERVICE_URL,
  progress: env.PROGRESS_SERVICE_URL,
  enrollment: env.ENROLLMENT_SERVICE_URL,
  media: env.MEDIA_SERVICE_URL,
  organization: env.ORGANIZATION_SERVICE_URL,
  analytics: env.ANALYTICS_SERVICE_URL,
  notification: env.NOTIFICATION_SERVICE_URL,
  scheduling: env.SCHEDULING_SERVICE_URL,
};

/**
 * Resolves the upstream base URL for a logical service.
 * The result is used as the `base` in serverFetch:
 *
 *   URL = base + UPSTREAM_API_PREFIX + path
 *       = "http://localhost:80" + "/api/v1" + "/schools/name-available"
 *
 * If API_GATEWAY_URL is set, all services route through it.
 * Otherwise, falls back to the per-service URL.
 */
export function resolveServiceUrl(name: ServiceName): string {
  if (env.API_GATEWAY_URL) {
    return env.API_GATEWAY_URL.replace(/\/$/, '');
  }
  const direct = directUrls[name];
  if (!direct) {
    throw new Error(`No upstream configured for service "${name}".`);
  }
  return direct.replace(/\/$/, '');
}

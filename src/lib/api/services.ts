import 'server-only';

import { env } from '@/lib/env';

export type ServiceName = 'auth' | 'profile' | 'content' | 'exercises' | 'progress' | 'enrollment' | 'media';

const directUrls: Record<ServiceName, string | undefined> = {
  auth: env.AUTH_SERVICE_URL,
  profile: env.PROFILE_SERVICE_URL,
  content: env.CONTENT_SERVICE_URL,
  exercises: env.EXERCISE_SERVICE_URL,
  progress: env.PROGRESS_SERVICE_URL,
  enrollment: env.ENROLLMENT_SERVICE_URL,
  media: env.MEDIA_SERVICE_URL,
};

/**
 * Resolves the upstream base URL for a logical service.
 *
 * If API_GATEWAY_URL is set, all services route through the gateway.
 * nginx routes by API path (/api/v1/auth/*, /api/v1/profiles/*, etc.),
 * so no service-name prefix is added — the path from serverFetch provides it.
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

import { createEnv } from '@t3-oss/env-nextjs';
import { z } from 'zod';

export const env = createEnv({
  server: {
    NODE_ENV: z.enum(['development', 'test', 'production']),

    // Either an aggregating gateway URL...
    API_GATEWAY_URL: z.string().url().optional(),

    // ...or per-service URLs while the gateway does not yet exist.
    AUTH_SERVICE_URL: z.string().url().optional(),
    PROFILE_SERVICE_URL: z.string().url().optional(),
    CONTENT_SERVICE_URL: z.string().url().optional(),
    EXERCISE_SERVICE_URL: z.string().url().optional(),
    PROGRESS_SERVICE_URL: z.string().url().optional(),
    ENROLLMENT_SERVICE_URL: z.string().url().optional(),
    MEDIA_SERVICE_URL: z.string().url().optional(),
    ORGANIZATION_SERVICE_URL: z.string().url().optional(),

    AUTH_COOKIE_SECRET: z.string().min(32),

    UPSTREAM_TIMEOUT_MS: z.coerce.number().int().positive().default(15_000),
  },
  client: {
    NEXT_PUBLIC_ENABLE_DEV_ROUTES: z
      .enum(['true', 'false'])
      .default('false')
      .transform((v) => v === 'true'),
  },
  runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
    API_GATEWAY_URL: process.env.API_GATEWAY_URL,
    AUTH_SERVICE_URL: process.env.AUTH_SERVICE_URL,
    PROFILE_SERVICE_URL: process.env.PROFILE_SERVICE_URL,
    CONTENT_SERVICE_URL: process.env.CONTENT_SERVICE_URL,
    EXERCISE_SERVICE_URL: process.env.EXERCISE_SERVICE_URL,
    PROGRESS_SERVICE_URL: process.env.PROGRESS_SERVICE_URL,
    ENROLLMENT_SERVICE_URL: process.env.ENROLLMENT_SERVICE_URL,
    MEDIA_SERVICE_URL: process.env.MEDIA_SERVICE_URL,
    ORGANIZATION_SERVICE_URL: process.env.ORGANIZATION_SERVICE_URL,
    AUTH_COOKIE_SECRET: process.env.AUTH_COOKIE_SECRET,
    UPSTREAM_TIMEOUT_MS: process.env.UPSTREAM_TIMEOUT_MS,
    NEXT_PUBLIC_ENABLE_DEV_ROUTES: process.env.NEXT_PUBLIC_ENABLE_DEV_ROUTES,
  },
});

if (typeof window === 'undefined' && !env.API_GATEWAY_URL) {
  const missing = (
    ['AUTH_SERVICE_URL', 'PROFILE_SERVICE_URL', 'CONTENT_SERVICE_URL'] as const
  ).filter((key) => !env[key]);
  if (missing.length > 0) {
    throw new Error(
      `Either API_GATEWAY_URL must be set, or all per-service URLs must be set. Missing: ${missing.join(', ')}`,
    );
  }
}

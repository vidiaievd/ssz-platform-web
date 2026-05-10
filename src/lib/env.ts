import { createEnv } from '@t3-oss/env-nextjs';
import { z } from 'zod';

export const env = createEnv({
  client: {
    NEXT_PUBLIC_ENABLE_DEV_ROUTES: z
      .enum(['true', 'false'])
      .default('false')
      .transform((v) => v === 'true'),
  },
  runtimeEnv: {
    NEXT_PUBLIC_ENABLE_DEV_ROUTES: process.env.NEXT_PUBLIC_ENABLE_DEV_ROUTES,
  },
});

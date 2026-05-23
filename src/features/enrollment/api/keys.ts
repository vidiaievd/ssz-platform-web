import { keyFactory } from '@/lib/query/keys';

export const enrollmentKeys = keyFactory('enrollment', {
  requests: () => ['requests'] as const,
  status: () => ['status'] as const,
});

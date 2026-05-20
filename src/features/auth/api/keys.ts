import { keyFactory } from '@/lib/query/keys';

export const authKeys = keyFactory('auth', {
  me: () => [] as const,
});

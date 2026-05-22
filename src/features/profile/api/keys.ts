import { keyFactory } from '@/lib/query/keys';

export const profileKeys = keyFactory('profile', {
  me: () => [] as const,
  public: (handle: string) => ['public', handle] as const,
});

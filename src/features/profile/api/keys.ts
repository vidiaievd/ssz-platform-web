import { keyFactory } from '@/lib/query/keys';

export const profileKeys = keyFactory('profile', {
  me: () => [] as const,
  tutorMe: () => ['tutor'] as const,
  teachingMe: () => ['teaching'] as const,
  studentMe: () => ['student'] as const,
  public: (handle: string) => ['public', handle] as const,
});

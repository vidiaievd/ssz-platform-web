import { keyFactory } from '@/lib/query/keys';

export const studentKeys = keyFactory('student', {
  progress: () => ['progress'] as const,
  upcoming: () => ['upcoming'] as const,
  streak: () => ['streak'] as const,
});

import { keyFactory } from '@/lib/query/keys';

export const studentKeys = keyFactory('student', {
  progress: () => ['progress'] as const,
  upcoming: () => ['upcoming'] as const,
  schools: () => ['schools'] as const,
  school: (schoolSlug: string) => ['school', schoolSlug] as const,
});

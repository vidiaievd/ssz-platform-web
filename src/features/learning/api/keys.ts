import { keyFactory } from '@/lib/query/keys';

export const learningKeys = keyFactory('learning', {
  srsDue:         () => ['srs', 'due'] as const,
  srsStats:       () => ['srs', 'stats'] as const,
  courseProgress: (courseId: string) => ['progress', 'course', courseId] as const,
  courseMastery:  (courseId: string) => ['mastery', 'course', courseId] as const,
  canDo:          (courseId?: string) => ['can-do', courseId ?? 'all'] as const,
});

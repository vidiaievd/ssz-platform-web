import { keyFactory } from '@/lib/query/keys';

export const learningKeys = keyFactory('learning', {
  srsDue:         () => ['srs', 'due'] as const,
  srsStats:       () => ['srs', 'stats'] as const,
  courseProgress: (courseId: string) => ['progress', 'course', courseId] as const,
  courseMastery:  (courseId: string) => ['mastery', 'course', courseId] as const,
  canDo:          (courseId?: string) => ['can-do', courseId ?? 'all'] as const,
  courseHome:        (courseId: string)  => ['course-home', courseId] as const,
  unitPayload:       (moduleId: string)  => ['unit', moduleId] as const,
  progressOverview:  (courseId?: string) => ['progress-overview', courseId ?? 'all'] as const,
});

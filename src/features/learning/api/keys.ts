import { keyFactory } from '@/lib/query/keys';

export const learningKeys = keyFactory('learning', {
  srsDue:         () => ['srs', 'due'] as const,
  srsStats:       () => ['srs', 'stats'] as const,
  courseProgress: (courseId: string) => ['progress', 'course', courseId] as const,
  courseMastery:  (courseId: string) => ['mastery', 'course', courseId] as const,
  canDo:          (courseId?: string) => ['can-do', courseId ?? 'all'] as const,
  courseHome:        (courseId: string)  => ['course-home', courseId] as const,
  unitPayload:       (moduleId: string)  => ['unit', moduleId] as const,
  unitContents:      (moduleId: string)  => ['unit-contents', moduleId] as const,
  progressOverview:  (courseId?: string) => ['progress-overview', courseId ?? 'all'] as const,
  assignments:       (courseId?: string) => ['assignments', courseId ?? 'all'] as const,
  assignment:        (id: string)        => ['assignment', id] as const,
  assignmentQuestions: (id: string)     => ['assignment-questions', id] as const,
});

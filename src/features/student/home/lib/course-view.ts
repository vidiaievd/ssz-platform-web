import { getEndonym } from '@/features/profile/lib/iso-languages';
import type { StudentCourse } from '@/features/student/types';
import type { CourseProgressCardData } from '../components/course-progress-card';
import type { ResumeHeroData } from '../components/resume-hero';

/**
 * Where the reader opens for a course. A started course resumes at its next
 * item; one that has never been opened goes to the course home, which is also
 * the only sensible target for a course with nothing left to do.
 */
export function courseHref(course: StudentCourse): string {
  return course.nextItemId
    ? `/student/enrolled/lessons/${course.nextItemId}?containerId=${course.containerId}`
    : `/student/courses/${course.containerId}`;
}

/**
 * The course to surface in the hero: the most recently opened one. If nothing
 * has been opened yet, the first available course — a student with access and
 * no history still deserves an obvious way in.
 */
export function pickResumeCourse(courses: StudentCourse[]): StudentCourse | null {
  if (!courses.length) return null;
  const started = courses.filter((c) => c.started);
  if (!started.length) return courses[0] ?? null;
  return started.reduce((a, b) => ((a.lastAccessedAt ?? '') >= (b.lastAccessedAt ?? '') ? a : b));
}

export function toResumeHero(course: StudentCourse): ResumeHeroData {
  return {
    langCode: course.targetLanguage,
    langName: getEndonym(course.targetLanguage),
    level: course.level ?? undefined,
    courseTitle: course.title,
    nextItemTitle: course.nextItemTitle ?? course.title,
    progressPercent: course.progressPercent,
    href: courseHref(course),
    started: course.started,
  };
}

/** Started courses first, most recently touched leading; untouched keep their given order. */
export function byRecency(a: StudentCourse, b: StudentCourse): number {
  if (a.started !== b.started) return a.started ? -1 : 1;
  return (b.lastAccessedAt ?? '').localeCompare(a.lastAccessedAt ?? '');
}

export interface CourseCardLabels {
  lessonNumber: (n: number) => string;
  /** A course never opened has no "next item" recorded — its label instead. */
  notStarted: string;
}

/**
 * Shared `StudentCourse` → `CourseProgressCardData` mapping. Takes the
 * caller's own resolved labels and relative-time function rather than a raw
 * translator, so it works the same from any client component regardless of
 * which namespace it happens to be scoped to.
 */
export function toCourseCardData(
  course: StudentCourse,
  labels: CourseCardLabels,
  formatRelativeTime: (date: Date) => string,
): CourseProgressCardData {
  return {
    id: course.containerId,
    langCode: course.targetLanguage,
    langName: getEndonym(course.targetLanguage),
    level: course.level ?? '',
    title: course.title,
    source: course.source,
    school: course.school?.name,
    progressPercent: course.progressPercent,
    completedItems: course.completedItems,
    totalItems: course.totalItems,
    nextUnitLabel: labels.lessonNumber(course.completedItems + 1),
    nextItemTitle: course.nextItemTitle ?? labels.notStarted,
    lastActiveLabel: course.lastAccessedAt
      ? formatRelativeTime(new Date(course.lastAccessedAt))
      : undefined,
  };
}

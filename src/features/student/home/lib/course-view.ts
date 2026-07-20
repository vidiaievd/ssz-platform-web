import { getEndonym } from '@/features/profile/lib/iso-languages';
import type { StudentCourse } from '@/features/student/types';
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

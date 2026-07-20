import { getEndonym } from '@/features/profile/lib/iso-languages';
import type { ContainerProgress } from '@/features/student/types';
import type { ResumeHeroData } from '../components/resume-hero';

/**
 * Container ids the student reaches through a school group, mapped to that
 * school's name. Anything absent from this map is self-study — the only two
 * sources a started course can have, so no guessing is involved.
 */
export type SchoolCourseMap = Record<string, string>;

/** Where the reader opens for a given progress row. */
export function resumeHref(item: ContainerProgress): string {
  return item.nextItemId
    ? `/student/enrolled/lessons/${item.nextItemId}?containerId=${item.containerId}`
    : `/student/my-courses`;
}

/**
 * The course to surface in the hero: the most recently touched one that still
 * has a next item. A finished course is not something to "resume".
 */
export function pickResumeCourse(items: ContainerProgress[]): ContainerProgress | null {
  const resumable = items.filter((i) => i.nextItemId && i.nextItemTitle);
  if (!resumable.length) return null;
  return resumable.reduce((a, b) =>
    (a.lastAccessedAt ?? '') >= (b.lastAccessedAt ?? '') ? a : b,
  );
}

export function toResumeHero(item: ContainerProgress): ResumeHeroData {
  return {
    langCode: item.targetLanguage,
    langName: getEndonym(item.targetLanguage),
    level: item.level,
    courseTitle: item.containerTitle,
    nextItemTitle: item.nextItemTitle ?? item.containerTitle,
    progressPercent: item.progressPercent,
    href: resumeHref(item),
  };
}

/** Most recently touched first — the order the student thinks in. */
export function byRecency(a: ContainerProgress, b: ContainerProgress): number {
  return (b.lastAccessedAt ?? '').localeCompare(a.lastAccessedAt ?? '');
}

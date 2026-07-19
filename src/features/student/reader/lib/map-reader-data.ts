import type { MaterialKind } from '@/lib/content/lesson-types';
import type { UnitContentsItem, UnitContentsResult, UnitSummary } from '@/features/learning';
import type { ReaderSidebarItem, ReaderSidebarSection, ReaderSidebarUnit } from '../types';

/**
 * `contentType` is learning-service's uppercase ContentType wire value
 * (LESSON/VOCABULARY_LIST/GRAMMAR_RULE/EXERCISE); `lessonKind` is
 * content-service's lowercase Lesson.kind domain value (text/video/audio/live),
 * already matching MaterialKind 1:1 for the LESSON case.
 */
export function mapContentItemKind(contentType: string, lessonKind: string | null): MaterialKind {
  switch (contentType) {
    case 'VOCABULARY_LIST':
      return 'vocab';
    case 'GRAMMAR_RULE':
      return 'grammar';
    case 'EXERCISE':
      return 'exercise';
    case 'LESSON':
    default:
      return (lessonKind as MaterialKind | null) ?? 'text';
  }
}

export function buildItemHref(courseId: string, unitId: string, itemId: string): string {
  return `/student/courses/${courseId}/${unitId}/${itemId}`;
}

function mapItem(
  item: UnitContentsItem,
  courseId: string,
  unitId: string,
  formatDuration: (minutes: number) => string,
): ReaderSidebarItem {
  return {
    id: item.id,
    kind: mapContentItemKind(item.contentType, item.lessonKind),
    title: item.title ?? '',
    durationLabel: item.durationMinutes != null ? formatDuration(item.durationMinutes) : '',
    status: item.status,
    href: buildItemHref(courseId, unitId, item.id),
  };
}

/** Maps the active unit's read-model payload to sidebar sections (+ a trailing "other items" bucket, if any). */
export function mapUnitContentsToSections(
  contents: UnitContentsResult,
  courseId: string,
  formatDuration: (minutes: number) => string,
  otherLabel: string,
): ReaderSidebarSection[] {
  const sections: ReaderSidebarSection[] = contents.sections.map((s) => ({
    id: s.id,
    label: s.title,
    items: s.items.map((i) => mapItem(i, courseId, contents.moduleId, formatDuration)),
  }));
  if (contents.ungroupedItems.length > 0) {
    sections.push({
      id: `${contents.moduleId}-ungrouped`,
      label: otherLabel,
      items: contents.ungroupedItems.map((i) => mapItem(i, courseId, contents.moduleId, formatDuration)),
    });
  }
  return sections;
}

/** Course-wide unit list with the active unit's sections attached; other units stay collapsed summaries. */
export function mapCourseUnitsToSidebarUnits(
  units: UnitSummary[],
  activeUnitId: string,
  activeUnitSections: ReaderSidebarSection[],
): ReaderSidebarUnit[] {
  return units.map((u) => ({
    id: u.id,
    position: u.position,
    title: u.title,
    status: u.status,
    sections: u.id === activeUnitId ? activeUnitSections : [],
  }));
}

export function flattenSections(sections: ReaderSidebarSection[]): ReaderSidebarItem[] {
  return sections.flatMap((s) => s.items);
}

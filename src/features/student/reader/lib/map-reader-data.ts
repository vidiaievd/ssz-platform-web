import type { MaterialKind } from '@/lib/content/lesson-types';
import type {
  CourseLevelGroup,
  UnitContentsItem,
  UnitContentsItemStatus,
  UnitContentsResult,
  UnitContentsSection,
  UnitSummary,
} from '@/features/learning';
import type {
  ReaderSidebarItem,
  ReaderSidebarLevel,
  ReaderSidebarSection,
  ReaderSidebarUnit,
} from '../types';

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

/**
 * Entry route of a sub-lesson. The page behind it redirects to the unit's first
 * material, which is what lets the sidebar link units it holds no contents for
 * (only the open unit's items are fetched).
 */
export function buildUnitHref(courseId: string, unitId: string): string {
  return `/student/courses/${courseId}/${unitId}`;
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

/**
 * Route id standing in for a whole exercise section. A section made only of
 * exercises is presented as ONE entry — a practice page holding every task —
 * instead of one sidebar row and one page per question.
 */
export const PRACTICE_ITEM_PREFIX = 'practice-';

export function practiceItemId(sectionId: string): string {
  return `${PRACTICE_ITEM_PREFIX}${sectionId}`;
}

/** `practice-<sectionId>` → `<sectionId>`; null for a regular item id. */
export function practiceSectionIdOf(itemId: string): string | null {
  return itemId.startsWith(PRACTICE_ITEM_PREFIX)
    ? itemId.slice(PRACTICE_ITEM_PREFIX.length)
    : null;
}

/** Only multi-task, exercise-only sections collapse; a lone exercise keeps its own row. */
export function isPracticeSection(section: UnitContentsSection): boolean {
  return section.items.length > 1 && section.items.every((i) => i.contentType === 'EXERCISE');
}

/** Worst-first rollup: the entry mirrors how far the learner is through the set. */
function rollUpStatus(items: UnitContentsItem[]): UnitContentsItemStatus {
  if (items.every((i) => i.status === 'completed')) return 'completed';
  if (items.every((i) => i.status === 'locked')) return 'locked';
  if (items.some((i) => i.status === 'completed' || i.status === 'in_progress')) return 'in_progress';
  return 'available';
}

export interface SidebarLabels {
  /** Bucket title for items that belong to no section. */
  other: string;
  /** Title of a collapsed exercise section, e.g. "All exercises". */
  practiceTitle: string;
  /** Meta line of a collapsed exercise section, e.g. "12 tasks". */
  practiceCount: (n: number) => string;
}

/** Maps the active unit's read-model payload to sidebar sections (+ a trailing "other items" bucket, if any). */
export function mapUnitContentsToSections(
  contents: UnitContentsResult,
  courseId: string,
  formatDuration: (minutes: number) => string,
  labels: SidebarLabels,
): ReaderSidebarSection[] {
  const otherLabel = labels.other;
  const sections: ReaderSidebarSection[] = contents.sections.map((s) => ({
    id: s.id,
    label: s.title,
    items: isPracticeSection(s)
      ? [
          {
            id: practiceItemId(s.id),
            kind: 'exercise' as const,
            title: labels.practiceTitle,
            durationLabel: labels.practiceCount(s.items.length),
            status: rollUpStatus(s.items),
            href: buildItemHref(courseId, contents.moduleId, practiceItemId(s.id)),
          },
        ]
      : s.items.map((i) => mapItem(i, courseId, contents.moduleId, formatDuration)),
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
  courseId: string,
  activeUnitId: string,
  activeUnitSections: ReaderSidebarSection[],
): ReaderSidebarUnit[] {
  return units.map((u) => ({
    id: u.id,
    position: u.position,
    title: u.title,
    status: u.status,
    href: buildUnitHref(courseId, u.id),
    sections: u.id === activeUnitId ? activeUnitSections : [],
  }));
}

/**
 * Route id the reader should open for a raw content item: exercises inside a
 * collapsed section are reached through their practice page, never directly.
 */
export function resolveNavigableItemId(contents: UnitContentsResult, itemId: string): string {
  const section = contents.sections.find((s) => s.items.some((i) => i.id === itemId));
  return section && isPracticeSection(section) ? practiceItemId(section.id) : itemId;
}

/**
 * Same as `mapCourseUnitsToSidebarUnits`, but keeps the course's "Leksjon"
 * grouping: the BFF already hands the units out grouped by course-version
 * section (`CourseHomePayload.levels`), so the reader only has to carry it
 * through instead of flattening it back into one list.
 */
export function mapCourseLevelsToSidebarLevels(
  levels: CourseLevelGroup[],
  courseId: string,
  activeUnitId: string,
  activeUnitSections: ReaderSidebarSection[],
): ReaderSidebarLevel[] {
  return levels.map((level) => ({
    id: level.id,
    position: level.position,
    title: level.title,
    active: level.units.some((u) => u.id === activeUnitId),
    units: mapCourseUnitsToSidebarUnits(level.units, courseId, activeUnitId, activeUnitSections),
  }));
}

export function flattenSections(sections: ReaderSidebarSection[]): ReaderSidebarItem[] {
  return sections.flatMap((s) => s.items);
}

/**
 * The sub-lesson that follows the open one in course order — what "Next" points
 * at once the reader runs out of items inside the current unit. Levels are
 * already in course order, so flattening them also carries the reader across a
 * Leksjon boundary into the first unit of the next one.
 *
 * Falls back to the flat unit list for courses whose units aren't grouped.
 */
export function findNextUnit(
  levels: ReaderSidebarLevel[],
  units: ReaderSidebarUnit[],
  activeUnitId: string,
): ReaderSidebarUnit | null {
  const ordered = levels.length > 0 ? levels.flatMap((l) => l.units) : units;
  const idx = ordered.findIndex((u) => u.id === activeUnitId);
  if (idx < 0) return null;
  return ordered[idx + 1] ?? null;
}

import { type NextRequest, NextResponse } from 'next/server';

import { serverFetch } from '@/lib/api/server-fetcher';
import { isAppError } from '@/lib/errors';
import type { Container, ContainerItem, ContainerSection } from '@/features/content/types';
import type {
  CanDoResponse,
  CourseLevelGroup,
  CourseMastery,
  CourseHomePayload,
  CourseInfo,
  CourseProgress,
  ModuleProgress,
  SkillMastery,
  SrsCard,
  UnitStatus,
  UnitSummary,
} from '@/features/learning/types';

/* ── Raw upstream shapes (learning-service, post course-redesign) ──────
 * These no longer match the BFF-facing types in @/features/learning/types
 * (that file models the contract this route hands to the frontend, not
 * what learning-service returns) — this route is the adapter between them.
 */

interface RawCourseProgressItem {
  contentType: string;
  contentId: string;
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
  completedAt: string | null;
  score: number | null;
  /** Sub-lesson (module) this leaf belongs to; null when directly under the course. */
  moduleId: string | null;
  isRequired: boolean;
}

interface RawCourseProgress {
  containerId: string;
  totalItems: number;
  completedItems: number;
  completionRatio: number;
  items: RawCourseProgressItem[];
}

interface RawCourseMastery {
  containerId: string;
  vocab: number;
  grammar: number;
  reading: number;
  listening: number;
  spoken: number;
  written: number;
  overall: number;
}

interface RawSrsDue {
  cards: SrsCard[];
  reviewedToday: number;
  dailyLimit: number;
  streakDays: number;
}

interface UnitRollup {
  total: number;
  completed: number;
  isComplete: boolean;
}

/**
 * Rolls the course's flat leaf-progress list up per sub-lesson. Each leaf
 * carries its `moduleId` (see content-service get-leaf-items), so this needs
 * no extra per-unit fetches.
 *
 * A sub-lesson counts as complete when all its REQUIRED items are done —
 * optional items never block progression. A sub-lesson with no required items
 * falls back to "all items done", and an empty one is complete by definition
 * so it can't stall the sequential chain.
 */
function rollUpByUnit(items: RawCourseProgressItem[]): Map<string, UnitRollup> {
  const byUnit = new Map<string, RawCourseProgressItem[]>();
  for (const item of items) {
    if (!item.moduleId) continue; // leaf sits directly under the course
    const bucket = byUnit.get(item.moduleId) ?? [];
    bucket.push(item);
    byUnit.set(item.moduleId, bucket);
  }

  const rollups = new Map<string, UnitRollup>();
  for (const [moduleId, unitItems] of byUnit) {
    const required = unitItems.filter((i) => i.isRequired);
    const gating = required.length > 0 ? required : unitItems;
    rollups.set(moduleId, {
      total: unitItems.length,
      completed: unitItems.filter((i) => i.status === 'COMPLETED').length,
      isComplete: gating.every((i) => i.status === 'COMPLETED'),
    });
  }
  return rollups;
}

/**
 * Per-sub-lesson unlock. In `open` mode nothing is ever locked. In `sequential`
 * mode only the first incomplete sub-lesson is active and everything after it
 * locks — already-completed units stay `done` even if reached out of order.
 */
function deriveUnitStatuses(
  moduleIds: string[],
  rollups: Map<string, UnitRollup>,
  gatingMode: 'open' | 'sequential',
): UnitStatus[] {
  let unlocked = true;
  return moduleIds.map((moduleId) => {
    // An unseeded/empty unit has no rollup — treat as complete so it can't stall.
    const isComplete = rollups.get(moduleId)?.isComplete ?? true;
    if (isComplete) return 'done';
    if (gatingMode === 'open') return 'active';
    if (unlocked) {
      unlocked = false;
      return 'active';
    }
    return 'locked';
  });
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> },
) {
  const { courseId } = await params;

  try {
    /* ── Phase 1: parallel upstream calls ─────────────────────────── */
    const [rawProgress, rawMastery, rawSrsDue, container] = await Promise.all([
      serverFetch<RawCourseProgress>({
        service: 'progress',
        path: `/progress/course/${courseId}`,
      }),
      serverFetch<RawCourseMastery>({
        service: 'progress',
        path: `/mastery/course/${courseId}`,
      }),
      serverFetch<RawSrsDue>({
        service: 'progress',
        path: '/srs/due',
      }),
      serverFetch<Container>({
        service: 'content',
        path: `/containers/${courseId}`,
      }),
    ]);

    // The can-do descriptor board needs hydration (descriptor text, CEFR level,
    // unit mapping) that the raw progress records don't carry — that would mean
    // an extra fetch per descriptor, which this route deliberately avoids (see
    // deriveUnitStatuses above). Degrades to empty; CanDoCard renders its empty
    // state. Revisit once learning-service exposes a hydrated can-do endpoint.
    const canDo: CanDoResponse = { items: [] };

    /* ── Phase 2: unit list from content structure (no per-unit progress
     * fetch — see deriveUnitStatuses) ──────────────────────────────── */
    let units: UnitSummary[] = [];
    let levels: CourseLevelGroup[] = [];
    const versionId = container.currentPublishedVersionId;
    if (versionId) {
      try {
        const [items, sections] = await Promise.all([
          serverFetch<ContainerItem[]>({
            service: 'content',
            path: `/containers/${courseId}/versions/${versionId}/items`,
          }),
          serverFetch<ContainerSection[]>({
            service: 'content',
            path: `/containers/${courseId}/versions/${versionId}/sections`,
          }),
        ]);
        const unitItems = items
          .filter((item) => item.itemType === 'container')
          .sort((a, b) => a.position - b.position);
        const rollups = rollUpByUnit(rawProgress.items);
        const statuses = deriveUnitStatuses(
          unitItems.map((item) => item.itemId),
          rollups,
          container.gatingMode ?? 'open',
        );
        units = unitItems.map((item, i) => {
          const rollup = rollups.get(item.itemId);
          return {
            id: item.itemId,
            position: item.position,
            title: item.title ?? `Unit ${item.position}`,
            status: statuses[i] ?? 'locked',
            completedLessons: rollup?.completed ?? 0,
            totalLessons: rollup?.total ?? 0,
          };
        });

        // Group units by their course-version section ("Leksjon") for the
        // course-home accordion. Units without a matching section are dropped
        // from `levels` (they still appear in the flat `units` list) — the
        // seeded course structure always assigns a section, so this is a
        // defensive fallback rather than the expected path.
        const sectionById = new Map(sections.map((s) => [s.id, s]));
        const unitByItemId = new Map(units.map((u) => [u.id, u]));
        const unitsBySectionId = new Map<string, UnitSummary[]>();
        unitItems.forEach((item) => {
          const unit = unitByItemId.get(item.itemId);
          if (!unit || !item.sectionId || !sectionById.has(item.sectionId)) return;
          const bucket = unitsBySectionId.get(item.sectionId) ?? [];
          bucket.push(unit);
          unitsBySectionId.set(item.sectionId, bucket);
        });
        levels = sections
          .filter((s) => unitsBySectionId.has(s.id))
          .sort((a, b) => a.position - b.position)
          .map((s) => ({
            id: s.id,
            title: s.title,
            position: s.position,
            units: unitsBySectionId.get(s.id)!,
          }));
      } catch {
        // Non-fatal: units/levels default to empty
      }
    }

    const modules: ModuleProgress[] = units.map((u) => ({
      moduleId: u.id,
      status: u.status === 'done' ? 'completed' : u.status === 'locked' ? 'not_started' : 'in_progress',
      completedLessons: u.completedLessons,
      totalLessons: u.totalLessons,
    }));

    const progress: CourseProgress = {
      courseId: container.id,
      totalLessons: rawProgress.totalItems,
      completedLessons: rawProgress.completedItems,
      percentComplete: rawProgress.completionRatio * 100,
      modules,
      lessons: [],
    };

    const skillEntry = (skill: string, value: number): SkillMastery => ({
      skill,
      masteryPercent: value * 100,
      successCount: 0,
      attemptCount: 0,
    });

    const mastery: CourseMastery = {
      courseId: container.id,
      overallMastery: rawMastery.overall * 100,
      bySkill: [
        skillEntry('vocabulary', rawMastery.vocab),
        skillEntry('grammar', rawMastery.grammar),
        skillEntry('reading', rawMastery.reading),
        skillEntry('listening', rawMastery.listening),
        skillEntry('speaking', rawMastery.spoken),
        skillEntry('writing', rawMastery.written),
      ],
    };

    /* ── Derive SRS breakdown from card sample ────────────────────── */
    // /srs/due no longer reports a total due count, only the fetched sample —
    // treat the sample itself as the due count (matches the split logic below).
    // Card shape no longer carries contentType; attribute all due to vocab.
    const srsDueCount = rawSrsDue.cards.length;
    const srsVocabDue = srsDueCount;
    const srsExerciseDue = 0;

    const courseInfo: CourseInfo = {
      id: container.id,
      title: container.title,
      cefrLevel: container.difficultyLevel,
      targetLanguage: container.targetLanguage,
    };

    const payload: CourseHomePayload = {
      courseInfo,
      units,
      levels,
      progress,
      mastery,
      srsDueCount,
      srsStreakDays: rawSrsDue.streakDays,
      srsReviewedToday: rawSrsDue.reviewedToday,
      srsVocabDue,
      srsExerciseDue,
      canDo,
      overdueAssignmentCount: 0,
    };

    return NextResponse.json(payload);
  } catch (e) {
    if (isAppError(e)) {
      if (e.code === 'unauthenticated') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      if (e.code === 'not_found') return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Failed to load course home' }, { status: 502 });
  }
}

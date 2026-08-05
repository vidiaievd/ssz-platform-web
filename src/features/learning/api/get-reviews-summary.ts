import 'server-only';

import { z } from 'zod';

import { getMyCourses } from '@/features/student/api/get-my-courses';
import type { StudentCourse } from '@/features/student/types';
import { serverFetch } from '@/lib/api/server-fetcher';
import { env } from '@/lib/env';

import type {
  ReviewCourseBreakdown,
  ReviewKind,
  ReviewsSummary,
  UpcomingReview,
} from '../types';

/**
 * Cards pulled from the due queue in one go. The queue is capped upstream by
 * `limit`, so this is also the ceiling on `totalDue` — high enough that a real
 * learner never reaches it, low enough to bound the join below.
 */
const DUE_CARD_LIMIT = 500;

/** Page size when expanding a vocabulary list into its item ids. */
const VOCAB_ITEM_LIMIT = 200;

const EMPTY: ReviewsSummary = {
  totalDue: 0,
  overdueCount: 0,
  byKind: { exercise: 0, vocabulary_word: 0 },
  breakdown: [],
  upcoming: [],
  unattributedDue: 0,
};

/* ── Upstream shapes ───────────────────────────────────────────────
 * Validated rather than trusted: this feeds both the Reviews screen and the
 * nav badge, and a shape change upstream must degrade to "nothing due"
 * instead of rendering NaN counters.
 */

const RawDueCard = z.object({
  id: z.string(),
  contentType: z.string(),
  contentId: z.string(),
  dueAt: z.string(),
});

const RawDueEnvelope = z.object({
  cards: z.array(RawDueCard).default([]),
});

const RawLeafItem = z.object({ type: z.string(), id: z.string() });
const RawLeafItems = z.array(RawLeafItem);

const RawVocabItems = z.object({
  items: z.array(z.object({ id: z.string() })).default([]),
});

type DueCard = z.infer<typeof RawDueCard>;

async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

/** `SrsContentType` → the UI's closed `ReviewKind`. Unknown types stay unmapped. */
function toKind(contentType: string): ReviewKind | null {
  switch (contentType.toUpperCase()) {
    case 'EXERCISE':
      return 'exercise';
    case 'VOCABULARY_WORD':
      return 'vocabulary_word';
    default:
      return null;
  }
}

/**
 * content-service's leaf-item walk lives behind `/internal/*` (InternalAuthGuard,
 * deliberately not routed through the public gateway), so it is called directly
 * the same way the authoring pre-flight does.
 */
function leafItems(courseId: string): Promise<unknown> {
  return serverFetch({
    service: 'content',
    path: `/internal/containers/${courseId}/leaf-items`,
    directBaseUrl: env.CONTENT_SERVICE_INTERNAL_URL,
    headers: { 'x-internal-token': env.INTERNAL_SERVICE_TOKEN ?? '' },
    anonymous: true,
  });
}

/**
 * `contentId → courseId` for every practisable leaf in the student's courses.
 *
 * The map is built course-first rather than card-first on purpose: an SRS card
 * carries no course reference, so the alternative is one content lookup per due
 * card. Walking each course once costs a bounded number of calls no matter how
 * deep the review backlog gets.
 *
 * Vocabulary needs the extra hop — a card points at a vocabulary *item*, while
 * a course only lists the *lists* — so lists are expanded only when the backlog
 * actually contains word cards.
 */
async function buildContentIndex(
  courses: StudentCourse[],
  kinds: Set<ReviewKind>,
): Promise<Map<string, string>> {
  const index = new Map<string, string>();
  if (!kinds.size || !env.CONTENT_SERVICE_INTERNAL_URL) return index;

  const perCourse = await Promise.all(
    courses.map(async (course) => {
      const raw = await safe(() => leafItems(course.containerId), null);
      const items = RawLeafItems.safeParse(raw).data ?? [];

      const exerciseIds = kinds.has('exercise')
        ? items.filter((i) => i.type === 'EXERCISE').map((i) => i.id)
        : [];

      const listIds = kinds.has('vocabulary_word')
        ? items.filter((i) => i.type === 'VOCABULARY_LIST').map((i) => i.id)
        : [];

      const wordIdBatches = await Promise.all(
        listIds.map(async (listId) => {
          const rawItems = await safe(
            () =>
              serverFetch({
                service: 'content',
                path: `/vocabulary-lists/${listId}/items`,
                query: { limit: String(VOCAB_ITEM_LIMIT) },
              }),
            null,
          );
          return (RawVocabItems.safeParse(rawItems).data?.items ?? []).map((i) => i.id);
        }),
      );

      return {
        courseId: course.containerId,
        contentIds: [...exerciseIds, ...wordIdBatches.flat()],
      };
    }),
  );

  for (const { courseId, contentIds } of perCourse) {
    for (const contentId of contentIds) {
      // First course wins: content shared between two courses still needs one
      // home, and attributing it twice would double-count the backlog.
      if (!index.has(contentId)) index.set(contentId, courseId);
    }
  }

  return index;
}

/** Start of the current UTC day — the boundary between "overdue" and "due today". */
function startOfDay(now: Date): number {
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
}

function courseMeta(course: StudentCourse) {
  return {
    courseId: course.containerId,
    courseTitle: course.title,
    language: course.targetLanguage,
    level: course.level,
  };
}

function buildBreakdown(
  cards: DueCard[],
  index: Map<string, string>,
  courses: Map<string, StudentCourse>,
): { breakdown: ReviewCourseBreakdown[]; unattributedDue: number } {
  const byRow = new Map<string, ReviewCourseBreakdown>();
  let unattributedDue = 0;

  for (const card of cards) {
    const kind = toKind(card.contentType);
    const course = courses.get(index.get(card.contentId) ?? '');
    if (!kind || !course) {
      unattributedDue += 1;
      continue;
    }

    const key = `${course.containerId}:${kind}`;
    const row = byRow.get(key);
    if (row) {
      row.dueCount += 1;
    } else {
      byRow.set(key, { ...courseMeta(course), kind, dueCount: 1 });
    }
  }

  const breakdown = [...byRow.values()].sort(
    (a, b) => b.dueCount - a.dueCount || a.courseTitle.localeCompare(b.courseTitle),
  );

  return { breakdown, unattributedDue };
}

function buildUpcoming(
  cards: DueCard[],
  index: Map<string, string>,
  courses: Map<string, StudentCourse>,
  now: Date,
): UpcomingReview[] {
  const byDay = new Map<string, UpcomingReview>();

  for (const card of cards) {
    const dueAt = Date.parse(card.dueAt);
    if (!Number.isFinite(dueAt) || dueAt <= now.getTime()) continue;

    const course = courses.get(index.get(card.contentId) ?? '');
    if (!course) continue;

    const day = new Date(dueAt).toISOString().slice(0, 10);
    const key = `${course.containerId}:${day}`;
    const row = byDay.get(key);
    if (row) {
      row.count += 1;
    } else {
      const { courseId, courseTitle, language } = courseMeta(course);
      byDay.set(key, { courseId, courseTitle, language, dueAt: day, count: 1 });
    }
  }

  return [...byDay.values()].sort((a, b) => a.dueAt.localeCompare(b.dueAt));
}

/**
 * Everything the Reviews screen needs, aggregated in the BFF: how much is due,
 * how much of it is overdue, and which course and kind each item belongs to.
 *
 * Purely a composition of existing endpoints — learning-service owns the
 * schedule, content-service owns the structure, and neither knows about the
 * other. Every upstream call degrades individually: a missing course index
 * moves items into `unattributedDue` rather than losing them.
 */
export async function getReviewsSummary(myUserId: string): Promise<ReviewsSummary> {
  const now = new Date();

  const [rawDue, courseList] = await Promise.all([
    safe(
      () =>
        serverFetch({
          service: 'progress',
          path: '/srs/due',
          query: { limit: String(DUE_CARD_LIMIT) },
        }),
      null,
    ),
    safe(() => getMyCourses(myUserId), [] as StudentCourse[]),
  ]);

  const cards = RawDueEnvelope.safeParse(rawDue).data?.cards ?? [];
  if (!cards.length) return EMPTY;

  const byKind: Record<ReviewKind, number> = { exercise: 0, vocabulary_word: 0 };
  const kinds = new Set<ReviewKind>();
  for (const card of cards) {
    const kind = toKind(card.contentType);
    if (!kind) continue;
    byKind[kind] += 1;
    kinds.add(kind);
  }

  const courses = new Map(courseList.map((c) => [c.containerId, c]));
  const index = await buildContentIndex(courseList, kinds);
  const { breakdown, unattributedDue } = buildBreakdown(cards, index, courses);

  const dayStart = startOfDay(now);
  const overdueCount = cards.filter((c) => {
    const dueAt = Date.parse(c.dueAt);
    return Number.isFinite(dueAt) && dueAt < dayStart;
  }).length;

  return {
    totalDue: cards.length,
    overdueCount,
    byKind,
    breakdown,
    upcoming: buildUpcoming(cards, index, courses, now),
    unattributedDue,
  };
}

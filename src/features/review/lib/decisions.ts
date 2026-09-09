import 'server-only';

import { serverFetch } from '@/lib/api/server-fetcher';
import { fetchProfileSummaries } from '@/lib/api/profile-directory';
import { env } from '@/lib/env';

import type { ReviewDecisionEntry } from '../types/oversight';

/** The engine's journal row: ids, instants and the path snapshot. No names. */
interface EngineDecision {
  attemptId: string;
  userId: string;
  exerciseId: string;
  exercisePath: { course?: string | null; module?: string | null; exercise?: string | null } | null;
  reviewerId: string;
  verdict: 'approved' | 'returned';
  submittedAt: string | null;
  reviewedAt: string;
}

interface EngineDecisionsPage {
  items: EngineDecision[];
  nextCursor: string | null;
}

/**
 * One page of the decision journal, with the people in it named.
 *
 * Shared by the screen and by the export precisely so the two cannot disagree: a CSV that
 * counted differently from the table above it would be worse than no CSV, since it is the
 * file that gets forwarded and quoted. The export walks this same function by cursor.
 *
 * A verdict recorded against an administrator appears here under their own name like any
 * other (criterion 32) — nothing distinguishes it, because nothing about it is different.
 */
export async function fetchDecisionsPage(input: {
  schoolId: string;
  periodDays: number;
  limit: number;
  cursor?: string | null;
}): Promise<{ items: ReviewDecisionEntry[]; nextCursor: string | null }> {
  const page = await serverFetch<EngineDecisionsPage>({
    service: 'exercises',
    path: '/internal/attempts/review/decisions',
    directBaseUrl: env.EXERCISE_SERVICE_INTERNAL_URL,
    headers: { 'x-internal-token': env.INTERNAL_SERVICE_TOKEN ?? '' },
    anonymous: true,
    query: {
      schoolId: input.schoolId,
      periodDays: input.periodDays,
      limit: input.limit,
      ...(input.cursor ? { cursor: input.cursor } : {}),
    },
  });

  const people = await fetchProfileSummaries([
    ...page.items.map((item) => item.userId),
    ...page.items.map((item) => item.reviewerId),
  ]);

  return {
    items: page.items.map((item) => ({
      id: item.attemptId,
      reviewedAt: item.reviewedAt,
      reviewerId: item.reviewerId,
      reviewerName: people[item.reviewerId]?.displayName ?? null,
      studentId: item.userId,
      studentName: people[item.userId]?.displayName ?? null,
      // The snapshot, not a lookup: an exercise deleted since is still what was decided
      // on, and the journal has to keep reading after the catalogue has moved on.
      exerciseTitle: item.exercisePath?.exercise ?? null,
      courseTitle: item.exercisePath?.course ?? null,
      verdict: item.verdict,
      hours:
        item.submittedAt === null
          ? null
          : Math.max(
              0,
              (new Date(item.reviewedAt).getTime() - new Date(item.submittedAt).getTime()) /
                3_600_000,
            ),
    })),
    nextCursor: page.nextCursor,
  };
}

/**
 * One CSV field, quoted the way a spreadsheet expects.
 *
 * Everything is quoted rather than only the fields that need it: names carry commas and
 * semicolons in some locales and not others, and a rule that decides per value is a rule
 * that will one day decide wrong on a name nobody tested with.
 */
export function csvField(value: string | number | null): string {
  if (value === null) return '""';
  return `"${String(value).replace(/"/g, '""')}"`;
}

export function csvRow(values: (string | number | null)[]): string {
  // CRLF: the line ending Excel treats as a row break on every platform it runs on.
  return `${values.map(csvField).join(',')}\r\n`;
}

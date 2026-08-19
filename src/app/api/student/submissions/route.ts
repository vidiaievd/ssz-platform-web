import { type NextRequest, NextResponse } from 'next/server';

import { getCurrentUser } from '@/features/auth/api/get-current-user';
import { serverFetch } from '@/lib/api/server-fetcher';
import { fetchProfileSummaries } from '@/lib/api/profile-directory';
import { env } from '@/lib/env';
import { buildSlaMap } from '@/features/review/lib/sla-map';
import type {
  MySubmission,
  MySubmissionsFilter,
  MySubmissionsResponse,
  MySubmissionStatus,
} from '@/features/student/submissions/types';

/** The engine's answer to `GET /internal/attempts/review/mine` (plan 47.1). */
interface EngineSubmission {
  attemptId: string;
  exerciseId: string;
  exercisePath: { course?: string | null; module?: string | null; exercise?: string | null } | null;
  containerId: string | null;
  schoolId: string | null;
  submittedAt: string;
  status: MySubmissionStatus;
  attemptNo: number;
  decision: {
    verdict: 'approved' | 'returned';
    byUserId: string;
    at: string;
    comment: string | null;
  } | null;
  canResubmit: boolean;
}

interface EngineList {
  items: EngineSubmission[];
  nextCursor: string | null;
}

const FILTERS: readonly MySubmissionsFilter[] = ['all', 'pending', 'returned', 'approved'];

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

const HOUR_MS = 60 * 60 * 1000;

/**
 * Everything one learner has handed in to a person, and what became of it.
 *
 * Three services answer three parts of one screen, and the split is the same as the
 * teacher's queue beside it. The engine holds what happened and authorises nothing — so
 * the learner id it is handed is the session's, never the caller's to name. The promise
 * comes from the school and its courses, because a response time is a thing a school said
 * and not a thing the engine knows (plan 44 §0.1). The teacher's name comes last, from the
 * directory, and its absence costs a name rather than the screen.
 *
 * What a learner must never see is absent by construction rather than by trimming: the
 * engine route this reads does not carry the answer key, the validator's breakdown, or
 * per-item notes, so there is nothing here to filter out and nothing for the next field
 * added upstream to slip through (invariant 1).
 */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  // A session without a subject is not a learner this list could be about — and the
  // engine takes the id as given, so guessing one here would be handing it someone
  // else's work.
  if (!user?.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = user.userId;

  const { searchParams } = request.nextUrl;
  const requested = searchParams.get('status');
  const status: MySubmissionsFilter = FILTERS.includes(requested as MySubmissionsFilter)
    ? (requested as MySubmissionsFilter)
    : 'all';
  const limit = Math.min(Number(searchParams.get('limit')) || DEFAULT_LIMIT, MAX_LIMIT);
  const cursor = searchParams.get('cursor');

  let list: EngineList;
  try {
    list = await serverFetch<EngineList>({
      service: 'exercises',
      path: '/internal/attempts/review/mine',
      directBaseUrl: env.EXERCISE_SERVICE_INTERNAL_URL,
      headers: { 'x-internal-token': env.INTERNAL_SERVICE_TOKEN ?? '' },
      anonymous: true,
      query: {
        userId,
        status,
        limit,
        ...(cursor ? { cursor } : {}),
      },
    });
  } catch {
    return NextResponse.json({ error: 'Failed to load your submissions' }, { status: 502 });
  }

  const [promises, people] = await Promise.all([
    resolvePromises(list.items),
    fetchProfileSummaries(list.items.map((item) => item.decision?.byUserId ?? '')),
  ]);

  const items: MySubmission[] = list.items.map((item) => ({
    id: item.attemptId,
    exerciseId: item.exerciseId,
    exerciseTitle: item.exercisePath?.exercise ?? null,
    course: item.exercisePath?.course ?? null,
    // The engine's snapshot calls it `module`, which is the shape of the catalogue; the
    // learner's word for the same thing is the one on their sidebar.
    lesson: item.exercisePath?.module ?? null,
    containerId: item.containerId,
    submittedAt: item.submittedAt,
    status: item.status,
    attemptNo: item.attemptNo,
    expectedResponseBy: expectedResponseBy(item, promises),
    decision: item.decision
      ? {
          verdict: item.decision.verdict,
          teacherId: item.decision.byUserId,
          teacherName: people[item.decision.byUserId]?.displayName ?? null,
          at: item.decision.at,
          comment: item.decision.comment,
        }
      : null,
    canResubmit: item.canResubmit,
  }));

  const body: MySubmissionsResponse = {
    summary:
      status === 'all'
        ? {
            pending: items.filter((item) => item.status === 'pending').length,
            returned: items.filter((item) => item.status === 'returned').length,
            partial: list.nextCursor !== null,
          }
        : null,
    items,
    nextCursor: list.nextCursor,
  };

  return NextResponse.json(body);
}

/**
 * The response time each school promised, for the courses on this page.
 *
 * One learner's list crosses schools — a private tutor and a language school make their
 * own promises — so the map is built per school rather than once for the page. Only
 * `pending` rows are asked about: a submission already answered has no answer still due,
 * and a promise resolved for it would be a lookup spent on a date nothing displays.
 */
async function resolvePromises(
  items: EngineSubmission[],
): Promise<Map<string, Awaited<ReturnType<typeof buildSlaMap>>>> {
  const bySchool = new Map<string, string[]>();
  for (const item of items) {
    if (item.status !== 'pending' || item.schoolId === null) continue;
    const containers = bySchool.get(item.schoolId) ?? [];
    if (item.containerId !== null) containers.push(item.containerId);
    bySchool.set(item.schoolId, containers);
  }

  const built = await Promise.all(
    [...bySchool].map(async ([schoolId, containers]) => {
      // A promise nobody could be read costs the date, never the row (`sla-map.ts`).
      return [schoolId, await buildSlaMap(schoolId, containers)] as const;
    }),
  );
  return new Map(built);
}

/**
 * When an answer is due, or `null` where nobody promised one.
 *
 * Only on `pending`: a returned or approved submission has been answered, and a date
 * beside it would be a deadline for something that already happened.
 */
function expectedResponseBy(
  item: EngineSubmission,
  promises: Map<string, Awaited<ReturnType<typeof buildSlaMap>>>,
): string | null {
  if (item.status !== 'pending' || item.schoolId === null) return null;

  const hours = promises.get(item.schoolId)?.slaFor(item.containerId) ?? null;
  if (hours === null) return null;

  return new Date(new Date(item.submittedAt).getTime() + hours * HOUR_MS).toISOString();
}

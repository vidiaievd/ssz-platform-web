import { type NextRequest, NextResponse } from 'next/server';

import { serverFetch } from '@/lib/api/server-fetcher';
import { isAppError } from '@/lib/errors';
import type {
  AttemptRecord,
  CheckMode,
  LastAttemptResponse,
  StartAttemptRequest,
  StartAttemptResponse,
} from '@/features/student/exercises/types/attempts';

/** The engine reports the running attempt's id in a field of the 409 body. */
function attemptIdOf(details: unknown): string | null {
  if (typeof details !== 'object' || details === null) return null;
  const { attemptId } = details as { attemptId?: unknown };
  return typeof attemptId === 'string' && attemptId !== '' ? attemptId : null;
}

/**
 * Abandon the stale attempt and start again. Returns `null` if either step fails, so
 * the caller reports the conflict rather than a half-recovered state.
 */
async function restart(
  exerciseId: string,
  staleAttemptId: string,
  language: string,
  mode: CheckMode | undefined,
): Promise<StartAttemptResponse | null> {
  try {
    await serverFetch({
      service: 'exercises',
      path: `/exercises/${exerciseId}/attempts/${staleAttemptId}`,
      method: 'DELETE',
    });
    return await serverFetch<StartAttemptResponse>({
      service: 'exercises',
      path: `/exercises/${exerciseId}/attempts`,
      method: 'POST',
      body: { language, ...(mode === undefined ? {} : { mode }) },
    });
  } catch {
    return null;
  }
}

/**
 * Start an attempt at an exercise.
 *
 * The first route in this client that talks to the exercise engine. It exists because
 * `word_bank_gap_fill` cannot be graded in the browser: its answers are the words
 * missing from the sentences, so the only copy of them is on the server.
 *
 * **Re-opening is the common case, not an edge one.** The engine keeps an attempt
 * IN_PROGRESS until something is submitted, so a learner who leaves the page and comes
 * back conflicts with themselves every time. This route clears that: an attempt with
 * nothing submitted holds nothing worth keeping — the placements only ever lived in the
 * browser — so it is abandoned, which is the truth of what happened, and a fresh one is
 * started. Doing it here rather than in the client keeps a three-step recovery out of a
 * component's render path.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { language, mode } = body as StartAttemptRequest;
  if (typeof language !== 'string' || language.trim() === '') {
    return NextResponse.json({ error: '"language" is required' }, { status: 400 });
  }

  try {
    const data = await serverFetch<StartAttemptResponse>({
      service: 'exercises',
      path: `/exercises/${id}/attempts`,
      method: 'POST',
      body: { language, ...(mode === undefined ? {} : { mode }) },
    });
    return NextResponse.json(data);
  } catch (e) {
    if (isAppError(e)) {
      if (e.code === 'unauthenticated') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      if (e.code === 'not_found') {
        return NextResponse.json({ error: 'Exercise not found' }, { status: 404 });
      }
      if (e.code === 'conflict') {
        const stale = attemptIdOf(e.details);
        if (stale !== null) {
          const restarted = await restart(id, stale, language, mode);
          if (restarted !== null) return NextResponse.json(restarted);
        }
        return NextResponse.json({ error: 'An attempt is already in progress' }, { status: 409 });
      }
    }
    return NextResponse.json({ error: 'Failed to start attempt' }, { status: 502 });
  }
}

/**
 * The stored validation details, for the templates whose details the learner may read.
 *
 * The engine strips these on the way out of a submission, but the attempt *record* keeps
 * them whole — the teacher queue reads the same row. `translate_*` details carry the
 * accepted translation of every sentence, so forwarding the record as it stands would
 * hand the answer key to anyone who reloaded the page after handing in. Only
 * `word_bank_gap_fill` details are learner-facing in full; translate keeps its routing,
 * which is what the runner draws its badges from; everything else is dropped.
 */
function learnerFacingDetails(templateCode: string, details: unknown): unknown {
  if (templateCode === 'word_bank_gap_fill') return details;
  if (templateCode !== 'translate_to_target' && templateCode !== 'translate_from_target') {
    return null;
  }

  if (typeof details !== 'object' || details === null) return null;
  const { items, totalItems, passedItems } = details as {
    items?: unknown;
    totalItems?: unknown;
    passedItems?: unknown;
  };
  if (!Array.isArray(items)) return null;

  return {
    totalItems,
    passedItems,
    items: items.map((item) => {
      const { itemId, routing } = item as { itemId: unknown; routing: unknown };
      return { itemId, routing };
    }),
  };
}

/**
 * The learner's last finished attempt at this exercise, or `null`.
 *
 * A list endpoint would be the obvious proxy, but the client has one question — "what
 * did I answer last time?" — and answering it from a page of attempts would put the
 * choice of *which* attempt counts in a component. It belongs here: an attempt is
 * finished once it has been scored or routed to a teacher, and IN_PROGRESS rows are
 * skipped because POST above abandons them on sight, so one is at most an artefact of
 * a page left open.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const page = await serverFetch<{ items: AttemptRecord[] }>({
      service: 'exercises',
      path: `/exercises/${id}/attempts`,
      method: 'GET',
      // Newest first upstream, so the first finished row in a short page is the one.
      query: { limit: 10 },
    });

    const found =
      page.items.find(
        (a) => a.status === 'SCORED' || a.status === 'ROUTED_FOR_REVIEW' || a.status === 'RETURNED',
      ) ?? null;
    const last =
      found === null
        ? null
        : {
            ...found,
            validationDetails: learnerFacingDetails(found.templateCode, found.validationDetails),
          };

    return NextResponse.json({ attempt: last } satisfies LastAttemptResponse);
  } catch (e) {
    if (isAppError(e)) {
      if (e.code === 'unauthenticated') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      // No exercise, no history — an empty past is not an error the runner should show.
      if (e.code === 'not_found') {
        return NextResponse.json({ attempt: null } satisfies LastAttemptResponse);
      }
    }
    return NextResponse.json({ error: 'Failed to load attempts' }, { status: 502 });
  }
}

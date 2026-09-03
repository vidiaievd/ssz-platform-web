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
 *
 * The fallback, not the first move: POST joins the open attempt where it can, and only
 * reaches here when the attempt cannot be joined or is in the wrong check mode.
 *
 * The draft travels across. Abandoning an attempt is safe for every template whose
 * unfinished work only ever lived in the browser — but an attempt can now hold a
 * server-side draft, and for `writing_task` that draft is the learner's text. Dropping
 * the row it sits on would make re-opening the page the one reliable way to lose an
 * evening's writing, which is exactly what saving it server-side was for. So the draft
 * is read before the abandon and written onto the fresh attempt after it.
 *
 * **Losing the race is not failing.** Two tabs on one exercise recover from the same
 * stale attempt at the same moment: both abandon it, both start, and the second start
 * conflicts with the attempt the first one just opened. That conflict names a *different*
 * attempt than the one this recovery set out to clear, and the difference is the whole
 * signal — the attempt is open, it is this learner's, and it can be submitted into. So
 * it is joined rather than cleared. Clearing it would pull the exercise out from under
 * the tab that is already using it.
 *
 * Once, not in a loop: a second conflict naming a second new attempt is no longer a race
 * between two tabs but an engine that will not settle, and retrying it forever would only
 * make that worse.
 */
async function restart(
  exerciseId: string,
  staleAttemptId: string,
  language: string,
  mode: CheckMode | undefined,
): Promise<StartAttemptResponse | null> {
  const carried = await draftOf(exerciseId, staleAttemptId);

  try {
    await serverFetch({
      service: 'exercises',
      path: `/exercises/${exerciseId}/attempts/${staleAttemptId}`,
      method: 'DELETE',
    });
    const started = await serverFetch<StartAttemptResponse>({
      service: 'exercises',
      path: `/exercises/${exerciseId}/attempts`,
      method: 'POST',
      body: { language, ...(mode === undefined ? {} : { mode }) },
    });

    if (carried !== null) await carryDraft(exerciseId, started.attemptId, carried);
    return started;
  } catch (e) {
    if (isAppError(e) && e.code === 'conflict') {
      const winner = attemptIdOf(e.details);
      // The draft is not carried again: the tab that won the race carried it onto this
      // very attempt a moment ago, and writing the older copy over it would undo
      // whatever has been typed since.
      if (winner !== null && winner !== staleAttemptId) {
        return join(exerciseId, winner, language, mode);
      }
    }
    return null;
  }
}

/**
 * Ask for an attempt that is already open, by name, and get it back as a start.
 *
 * The engine hands over the attempt with its board — the projection is dealt server-side
 * and seeded by the attempt's own id, so this is the same table, the same shuffle and the
 * same masking the tab that opened it is looking at. Reading the attempt record instead
 * would not do: it carries the answers and the draft, but not the content.
 */
async function join(
  exerciseId: string,
  attemptId: string,
  language: string,
  mode: CheckMode | undefined,
): Promise<StartAttemptResponse | null> {
  try {
    return await serverFetch<StartAttemptResponse>({
      service: 'exercises',
      path: `/exercises/${exerciseId}/attempts`,
      method: 'POST',
      body: { language, joinAttemptId: attemptId, ...(mode === undefined ? {} : { mode }) },
    });
  } catch {
    return null;
  }
}

/** The stale attempt's unfinished work, or `null` — including when asking fails. */
async function draftOf(exerciseId: string, attemptId: string): Promise<unknown | null> {
  try {
    const attempt = await serverFetch<{ draftAnswer?: unknown }>({
      service: 'exercises',
      path: `/exercises/${exerciseId}/attempts/${attemptId}`,
      method: 'GET',
    });
    return attempt.draftAnswer ?? null;
  } catch {
    return null;
  }
}

/**
 * Put the carried draft on the new attempt.
 *
 * Failure is swallowed on purpose: the fresh attempt is already started and usable, and
 * refusing to hand it over because the text could not be copied would turn a lost draft
 * into a lost exercise. The text is not destroyed either way — it stays on the abandoned
 * row, where support can still find it.
 */
async function carryDraft(
  exerciseId: string,
  attemptId: string,
  draftAnswer: unknown,
): Promise<void> {
  try {
    await serverFetch({
      service: 'exercises',
      path: `/exercises/${exerciseId}/attempts/${attemptId}/draft`,
      method: 'PUT',
      body: { draftAnswer },
    });
  } catch {
    /* the attempt stands; see above */
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
 * back conflicts with themselves every time. This route resolves that, and it tries to
 * *join* the open attempt before it tries to clear it.
 *
 * Joining first, because "an attempt with nothing submitted holds nothing worth keeping"
 * turned out to be false in the one case that matters: a second tab. An attempt opened a
 * second ago by a tab the learner is still looking at is indistinguishable from one left
 * over from yesterday, and clearing it took the exercise out from under that tab — its
 * hand-in came back 502 and the learner was told their answers could not be sent
 * (measured 02.09, two tabs opened in turn). Joining is right for the stale case too: the
 * attempt comes back with its own board, the draft is already on it, and re-opening a
 * page stops leaving a trail of abandoned rows behind it.
 *
 * Clearing is still the fallback — when the attempt cannot be joined at all, and when it
 * is in the wrong check mode, since a PRACTICE attempt must not swallow the learner's
 * move to a GRADED one. Doing all of this here rather than in the client keeps a
 * multi-step recovery out of a component's render path.
 *
 * One attempt is never abandoned, and this route never sees it: a `short_answer` set
 * that already holds handed-in answers comes back from the engine as a resumed attempt
 * rather than a conflict (plan 51 §8 Q6). Its answers were graded and written down on
 * the server, so there is nothing here to recover and nothing to throw away.
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
          /*
           * The mode the caller would have got had there been no attempt open. This route
           * never sends an assignmentId, so the engine's default for it is PRACTICE; an
           * open attempt in the other mode is therefore not the one being asked for, and
           * joining it would quietly answer a GRADED request with a PRACTICE board (or the
           * reverse, handing over answers that were meant to be withheld). Mismatch falls
           * through to the clear-and-restart below, which honours the mode as asked.
           */
          const wanted = mode ?? 'PRACTICE';
          const joined = await join(id, stale, language, mode);
          if (joined !== null && joined.checkMode === wanted) {
            return NextResponse.json(joined);
          }

          const restarted = await restart(id, stale, language, mode);
          if (restarted !== null) return NextResponse.json(restarted);
        }
        // The running attempt survived the recovery above — the abandon failed, or the
        // fresh start did. That is not the end of the road for the caller: an attempt
        // already open is one they can submit into, which is what "carry on with the one
        // you started" means. So its id travels with the 409 rather than being spent
        // here, and a caller that has an answer in hand can finish the job (47.3).
        return NextResponse.json(
          {
            error: 'An attempt is already in progress',
            ...(stale === null ? {} : { attemptId: stale }),
          },
          { status: 409 },
        );
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
 * skipped: POST above abandons an empty one on sight, and a resumed `short_answer` set
 * is still being answered — either way it is not a past answer to show.
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

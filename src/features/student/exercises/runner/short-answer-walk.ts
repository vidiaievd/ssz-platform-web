/**
 * Where the learner is in a `short_answer` set: which questions are handed in and which
 * were skipped. A question in neither has not been reached yet.
 *
 * Skipping is a pass over a question, not an answer to it — nothing goes to the server, and
 * the question stays open until it is answered or the set is sent without it. The engine
 * then grades it as an answer that said nothing, so a gap counts against the set instead of
 * vanishing from it. The same walk as VoxOrd's `templates/shortAnswer.ts`.
 */
export interface ShortAnswerWalk {
  answered: readonly string[];
  skipped: readonly string[];
}

export const EMPTY_WALK: ShortAnswerWalk = { answered: [], skipped: [] };

/**
 * The next question not yet reached, looking forward from `from` and then from the top.
 * `null` once every question is answered or skipped.
 */
export function nextUnreached(
  ids: readonly string[],
  from: number,
  walk: ShortAnswerWalk,
): number | null {
  return findFrom(ids, from, (id) => !walk.answered.includes(id) && !walk.skipped.includes(id));
}

/**
 * The skipped question to go back to: the next one after `from`, then from the top — so
 * skipping it again moves on to the following skipped question rather than back to itself.
 */
export function nextSkipped(
  ids: readonly string[],
  from: number,
  walk: ShortAnswerWalk,
): number | null {
  return findFrom(ids, from, (id) => walk.skipped.includes(id) && !walk.answered.includes(id));
}

/** Questions the set would be sent without — every one not handed in. */
export function unansweredCount(ids: readonly string[], walk: ShortAnswerWalk): number {
  return ids.filter((id) => !walk.answered.includes(id)).length;
}

function findFrom(
  ids: readonly string[],
  from: number,
  wanted: (id: string) => boolean,
): number | null {
  for (let step = 1; step <= ids.length; step++) {
    const i = (from + step) % ids.length;
    if (wanted(ids[i]!)) return i;
  }
  return null;
}

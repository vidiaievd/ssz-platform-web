/**
 * The learner's unsent answer, kept in the browser (47.0.C).
 *
 * A draft, not an outbox. The progress ping is queued and resent without asking
 * (`learning/lib/progress-outbox.ts`) because a checkbox carries no decision; an answer
 * does. Sending a person's own words on their behalf, after they saw a failure and may
 * have thought better of it, is not this module's to do — it restores the field and the
 * learner presses the button.
 *
 * Keyed by exercise rather than by attempt on purpose: reopening an exercise abandons the
 * running attempt and starts a fresh one (`api/exercises/[id]/attempts/route.ts`), so the
 * attempt id a draft was written under is precisely the one that no longer exists by the
 * time the draft is needed.
 */

const PREFIX = 'exercise-answer-draft:';

/** Old enough that the exercise has almost certainly moved on without it. */
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

interface StoredDraft {
  savedAt: number;
  answer: unknown;
}

function keyOf(exerciseId: string): string {
  return `${PREFIX}${exerciseId}`;
}

/**
 * Keeps the answer as it currently stands, replacing whatever was there.
 *
 * An empty answer clears instead of storing nothing-shaped: a learner who wiped the field
 * meant to wipe it, and a draft that resurrects cleared work on the next reload would be
 * undoing them.
 */
export function saveAnswerDraft(exerciseId: string, answer: unknown): void {
  if (typeof window === 'undefined') return;
  if (answer === null || (typeof answer === 'object' && Object.keys(answer).length === 0)) {
    clearAnswerDraft(exerciseId);
    return;
  }
  try {
    const entry: StoredDraft = { savedAt: Date.now(), answer };
    window.localStorage.setItem(keyOf(exerciseId), JSON.stringify(entry));
  } catch {
    // Storage full or unavailable. The answer is still in the field in front of the
    // learner; only surviving a reload is lost, and there is nothing to tell them.
  }
}

/**
 * The stored answer, or `null` when there is none this runner should use. The shape is
 * the caller's to read: each template stores its own, and a draft written by an older
 * version of one is a draft this one should ignore rather than half-understand.
 */
export function readAnswerDraft(exerciseId: string): unknown {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(keyOf(exerciseId));
    if (raw === null) return null;

    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const { savedAt, answer } = parsed as Partial<StoredDraft>;
    if (typeof savedAt !== 'number' || Date.now() - savedAt > MAX_AGE_MS) {
      clearAnswerDraft(exerciseId);
      return null;
    }
    return answer ?? null;
  } catch {
    return null;
  }
}

/** Drops the draft — the work reached the engine, or the learner started over. */
export function clearAnswerDraft(exerciseId: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(keyOf(exerciseId));
  } catch {
    // Nothing to do and nothing to say; a stale draft ages out on its own.
  }
}

/**
 * Drops every draft — on sign-out.
 *
 * These hold what a person wrote, and the next person to sign in on this machine has no
 * business being handed it, whatever the field would do with the shape.
 */
export function clearAnswerDrafts(): void {
  if (typeof window === 'undefined') return;
  try {
    const keys = Object.keys(window.localStorage).filter((key) => key.startsWith(PREFIX));
    for (const key of keys) window.localStorage.removeItem(key);
  } catch {
    // Same as above: unreachable storage is not a thing to report over a draft.
  }
}

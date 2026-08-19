'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/** What a reviewer has written about one submission but not yet sent. */
export interface ReviewDraft {
  /** The comment on the work as a whole — the one the verdict buttons turn on. */
  comment: string;
  /** Comments against single sentences, by item id. */
  sentences: Record<string, string>;
  /** When it was last written to. Only used to decide what to forget first. */
  touchedAt: number;
}

interface ReviewDraftsState {
  drafts: Record<string, ReviewDraft>;
  setComment: (attemptId: string, comment: string) => void;
  /** `undefined` removes the comment — taking one off is as ordinary as adding one. */
  setSentenceComment: (attemptId: string, itemId: string, comment: string | undefined) => void;
  /** The reviewer's own verdict landed. The only thing that empties a draft. */
  clear: (attemptId: string) => void;
}

export const EMPTY_DRAFT: ReviewDraft = { comment: '', sentences: {}, touchedAt: 0 };

/**
 * How many submissions' drafts are kept before the oldest are forgotten.
 *
 * A ceiling exists because nothing else prunes this: a draft is only cleared by its own
 * verdict, so every submission a teacher opened, typed into and walked away from would
 * otherwise sit in local storage forever. Forty is far more than one marking pass, and
 * what falls off the end is by definition the thing nobody came back to.
 */
const MAX_DRAFTS = 40;

/**
 * What the teacher has written and not yet sent, kept where it survives everything.
 *
 * Criterion 15 is the whole specification of this file: a draft outlives leaving the page,
 * switching to another submission and coming back, and — the case it exists for — a
 * colleague getting there first. That last one is why clearing is deliberately narrow.
 * When a verdict comes back 409 the screen goes read-only, and the two paragraphs the
 * teacher wrote are the only thing left worth having: they are shown, they can be copied,
 * and nothing about somebody else's decision touches them.
 *
 * Local storage rather than the server, because a draft is not a message. It has no
 * recipient until a verdict is pressed, and a half-written correction synced to a
 * colleague's screen would be worse than one lost on a browser change.
 */
export const useReviewDraftsStore = create<ReviewDraftsState>()(
  persist(
    (set) => ({
      drafts: {},

      setComment: (attemptId, comment) =>
        set((state) => write(state, attemptId, (draft) => ({ ...draft, comment }))),

      setSentenceComment: (attemptId, itemId, comment) =>
        set((state) =>
          write(state, attemptId, (draft) => {
            if (comment === undefined || comment.trim() === '') {
              const { [itemId]: _removed, ...rest } = draft.sentences;
              return { ...draft, sentences: rest };
            }
            return { ...draft, sentences: { ...draft.sentences, [itemId]: comment } };
          }),
        ),

      clear: (attemptId) =>
        set((state) => {
          const { [attemptId]: _sent, ...rest } = state.drafts;
          return { drafts: rest };
        }),
    }),
    { name: 'ssz:review:drafts:v1' },
  ),
);

/** One draft rewritten, stamped, and the oldest dropped if there are now too many. */
function write(
  state: ReviewDraftsState,
  attemptId: string,
  change: (draft: ReviewDraft) => ReviewDraft,
): Pick<ReviewDraftsState, 'drafts'> {
  const current = state.drafts[attemptId] ?? EMPTY_DRAFT;
  const next = { ...change(current), touchedAt: Date.now() };

  // An empty draft is not a draft. Otherwise clearing a comment character by character
  // would leave a permanent entry behind for a submission with nothing written on it.
  const drafts = { ...state.drafts };
  if (next.comment === '' && Object.keys(next.sentences).length === 0) {
    delete drafts[attemptId];
    return { drafts };
  }

  drafts[attemptId] = next;
  if (Object.keys(drafts).length <= MAX_DRAFTS) return { drafts };

  const oldest = Object.entries(drafts).sort(([, a], [, b]) => a.touchedAt - b.touchedAt);
  for (const [id] of oldest.slice(0, oldest.length - MAX_DRAFTS)) delete drafts[id];
  return { drafts };
}

/** The draft for one submission, or an empty one — never `undefined` at a call site. */
export function selectDraft(attemptId: string) {
  return (state: ReviewDraftsState): ReviewDraft => state.drafts[attemptId] ?? EMPTY_DRAFT;
}

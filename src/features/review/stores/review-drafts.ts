'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/** What a reviewer has written about one submission but not yet sent. */
export interface ReviewDraft {
  /** The comment on the work as a whole — the one the verdict buttons turn on. */
  comment: string;
  /** Comments against single sentences, by item id. */
  sentences: Record<string, string>;
  /**
   * Rubric marks 0-3, by criterion id — `writing_task` and anything else graded that way.
   *
   * Kept beside the comment for the same reason and with more at stake: a filled rubric
   * is four or six judgements made while reading a text once, and a colleague answering
   * first must not cost the reviewer the reading. Never pre-filled — an absent key is a
   * criterion nobody has marked, which is what keeps the action disabled.
   */
  marks: Record<string, number>;
  /** When it was last written to. Only used to decide what to forget first. */
  touchedAt: number;
}

interface ReviewDraftsState {
  drafts: Record<string, ReviewDraft>;
  setComment: (attemptId: string, comment: string) => void;
  /** `undefined` removes the comment — taking one off is as ordinary as adding one. */
  setSentenceComment: (attemptId: string, itemId: string, comment: string | undefined) => void;
  /** One rubric mark. There is no way to unset one: a teacher changes a mark, never blanks it. */
  setMark: (attemptId: string, criterionId: string, mark: number) => void;
  /** The reviewer's own verdict landed. The only thing that empties a draft. */
  clear: (attemptId: string) => void;
}

export const EMPTY_DRAFT: ReviewDraft = { comment: '', sentences: {}, marks: {}, touchedAt: 0 };

/**
 * How many submissions' drafts are kept before the oldest are forgotten.
 *
 * A ceiling exists because nothing else prunes this: a draft is only cleared by its own
 * verdict, so every submission a teacher opened, typed into and walked away from would
 * otherwise sit in local storage forever. Forty is far more than one marking pass, and
 * what falls off the end is by definition the thing nobody came back to.
 */
const MAX_DRAFTS = 40;

/** Bumped when the draft shape gains a field an existing entry would come back without. */
const DRAFTS_VERSION = 2;

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

      setMark: (attemptId, criterionId, mark) =>
        set((state) =>
          write(state, attemptId, (draft) => ({
            ...draft,
            marks: { ...draft.marks, [criterionId]: mark },
          })),
        ),

      clear: (attemptId) =>
        set((state) => {
          const { [attemptId]: _sent, ...rest } = state.drafts;
          return { drafts: rest };
        }),
    }),
    {
      name: 'ssz:review:drafts:v1',
      version: DRAFTS_VERSION,
      migrate: fillMarks,
    },
  ),
);

/**
 * Give every stored draft the `marks` key it was written before.
 *
 * Done once on rehydrate rather than in `selectDraft`, which is a Zustand selector: one
 * that patched the object would return a new reference on every render and put the panel
 * in a re-render loop. A missing `marks` is only ever an old entry, so this is the right
 * place — and dropping the drafts instead would throw away comments to add an empty
 * object.
 */
function fillMarks(persisted: unknown): { drafts: Record<string, ReviewDraft> } {
  const state = (persisted ?? {}) as { drafts?: Record<string, Partial<ReviewDraft>> };
  const drafts: Record<string, ReviewDraft> = {};

  for (const [id, draft] of Object.entries(state.drafts ?? {})) {
    drafts[id] = {
      comment: draft.comment ?? '',
      sentences: draft.sentences ?? {},
      marks: draft.marks ?? {},
      touchedAt: draft.touchedAt ?? 0,
    };
  }

  return { drafts };
}

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
  if (
    next.comment === '' &&
    Object.keys(next.sentences).length === 0 &&
    Object.keys(next.marks).length === 0
  ) {
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

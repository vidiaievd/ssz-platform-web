/**
 * One reversible edit of the course structure.
 *
 * Not a snapshot of the tree, the way the design prototype does it: every edit
 * here has already reached content-service, so putting the tree back means
 * sending the opposite request, not restoring a client-side copy. That is also
 * why an entry can fail — `revert` reports whether the server accepted it.
 */
export interface UndoEntry {
  /** What the toast says was done, e.g. "Moved “Leksjon 17”." */
  label: string;
  revert: () => Promise<boolean>;
}

/**
 * How many edits stay undoable (BEHAVIOR.md §2, `history/undo`). Old entries
 * fall off the bottom rather than the top: the oldest edit is the one an author
 * is least likely to reach for.
 */
export const UNDO_DEPTH = 40;

export function pushUndoEntry(stack: readonly UndoEntry[], entry: UndoEntry): UndoEntry[] {
  const next = [...stack, entry];
  return next.length > UNDO_DEPTH ? next.slice(next.length - UNDO_DEPTH) : next;
}

/**
 * Drops one entry wherever it sits, which is what the toast's Undo needs: it
 * offers a specific edit, and by the time it is pressed the author may have
 * made another one on top.
 */
export function dropUndoEntry(stack: readonly UndoEntry[], entry: UndoEntry): UndoEntry[] {
  return stack.filter((candidate) => candidate !== entry);
}

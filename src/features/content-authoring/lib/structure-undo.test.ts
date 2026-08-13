import { describe, expect, it } from 'vitest';

import { UNDO_DEPTH, dropUndoEntry, pushUndoEntry, type UndoEntry } from './structure-undo';

function entry(label: string): UndoEntry {
  return { label, revert: async () => true };
}

describe('structure undo stack', () => {
  it('keeps the newest edit last', () => {
    const stack = pushUndoEntry(pushUndoEntry([], entry('a')), entry('b'));
    expect(stack.map((e) => e.label)).toEqual(['a', 'b']);
  });

  it('drops the oldest edit once the depth is reached', () => {
    let stack: UndoEntry[] = [];
    for (let i = 0; i < UNDO_DEPTH + 3; i++) stack = pushUndoEntry(stack, entry(`e${i}`));

    expect(stack).toHaveLength(UNDO_DEPTH);
    expect(stack[0]?.label).toBe('e3');
    expect(stack.at(-1)?.label).toBe(`e${UNDO_DEPTH + 2}`);
  });

  it('removes one entry from the middle — a toast can be pressed after later edits', () => {
    const middle = entry('b');
    const stack = [entry('a'), middle, entry('c')];

    expect(dropUndoEntry(stack, middle).map((e) => e.label)).toEqual(['a', 'c']);
  });
});

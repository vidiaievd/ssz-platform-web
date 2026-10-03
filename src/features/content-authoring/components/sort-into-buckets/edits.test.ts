import { describe, expect, it } from 'vitest';

import {
  EI,
  EN,
  ET,
  exercise,
  item,
} from '@/lib/shared-kernel/sort-into-buckets/fixtures.test-support';

import { reorderBuckets, reorderItems } from './edits';

describe('reordering', () => {
  it('moves buckets without changing an id, a rule, an item or an explanation (AC-B7)', () => {
    const before = { ...exercise(), updatedAt: 'x' };

    const after = reorderBuckets(before, [ET.id, EN.id, EI.id]);

    expect(after.buckets.map((b) => b.id)).toEqual([ET.id, EN.id, EI.id]);
    expect(after.buckets).toEqual([ET, EN, EI]);
    expect(after.items).toBe(before.items);
    expect(after.fb).toBe(before.fb);
    expect(after.updatedAt).toBe('x');
  });

  it('keeps every explanation with its item when the items are dragged (AC-I3)', () => {
    const before = exercise({
      items: [item('i1', 'bil', EN.id), item('i2', 'bok', EI.id), item('i3', 'hus', ET.id)],
      fb: {
        i1: { def: 'one', ov: {} },
        i2: { def: 'two', ov: { [EN.id]: 'two in en' } },
        i3: { def: 'three', ov: {} },
      },
    });

    const after = reorderItems(before, ['i3', 'i1', 'i2']);

    expect(after.items.map((i) => i.id)).toEqual(['i3', 'i1', 'i2']);
    expect(after.fb).toEqual(before.fb);
  });

  it('ignores an order that is not a permutation of what is there', () => {
    const before = exercise();

    expect(reorderBuckets(before, [EN.id, 'nope', ET.id])).toBe(before);
    expect(reorderItems(before, ['i1'])).toBe(before);
  });
});

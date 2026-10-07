import { describe, expect, it } from 'vitest';

import {
  sampleDocument,
  toContent,
  toExpectedAnswers,
  toStudentProjection,
  type ReadAloudContent,
} from '@/lib/shared-kernel/read-aloud';

import { readReadAloudProjection } from './read-aloud-projection';

const deal = (ex: ReadAloudContent = sampleDocument()) =>
  JSON.parse(JSON.stringify(toStudentProjection(toContent(ex), toExpectedAnswers(ex)))) as Record<
    string,
    unknown
  >;

describe('readReadAloudProjection', () => {
  it('accepts what the kernel deals', () => {
    const read = readReadAloudProjection(deal());
    expect(read).not.toBeNull();
    expect(read?.prompts.map((p) => p.id)).toEqual(['p1aaaa', 'p2bbbb']);
    expect(read?.prompts[0]?.text).toContain('Jeg søkte');
    expect(read?.rubric).toBeUndefined();
  });

  it('accepts the rubric under showRubric: always', () => {
    const ex = sampleDocument();
    ex.settings.showRubric = 'always';
    const read = readReadAloudProjection(deal(ex));
    expect(read?.rubric?.length).toBe(3);
    expect(read?.rubric?.[0]?.levels).toHaveLength(4);
  });

  it('reads the carried prompts and ignores entries the exercise does not have (phase 11b)', () => {
    const p = deal();
    p['carried'] = [
      { itemId: 'p1aaaa', attempt: 1 },
      { itemId: 'gone', attempt: 1 },
      { itemId: 'p2bbbb', attempt: 0 },
    ];
    expect(readReadAloudProjection(p)?.carried).toEqual([{ itemId: 'p1aaaa', attempt: 1 }]);
    expect(readReadAloudProjection(deal())?.carried).toBeUndefined();
  });

  it.each([
    [
      'a listening note',
      (p: Record<string, unknown>) =>
        ((p['prompts'] as Record<string, unknown>[])[0]!['note'] = 'x'),
    ],
    [
      'focus words',
      (p: Record<string, unknown>) =>
        ((p['prompts'] as Record<string, unknown>[])[0]!['focus'] = []),
    ],
    [
      'the pass mark',
      (p: Record<string, unknown>) => ((p['settings'] as Record<string, unknown>)['passScore'] = 9),
    ],
    ['the AI stage', (p: Record<string, unknown>) => (p['review'] = {})],
    ['a rubric outside «always»', (p: Record<string, unknown>) => (p['rubric'] = [])],
  ])('refuses a document carrying %s (RA-M5, RA-M6)', (_name, leak) => {
    const p = deal();
    leak(p);
    expect(readReadAloudProjection(p)).toBeNull();
  });

  it('refuses an authoring criterion under «always»', () => {
    const ex = sampleDocument();
    ex.settings.showRubric = 'always';
    const p = deal(ex);
    (p['rubric'] as Record<string, unknown>[])[0]!['weight'] = 2;
    expect(readReadAloudProjection(p)).toBeNull();
  });

  it('refuses something that is not a projection at all', () => {
    expect(readReadAloudProjection(null)).toBeNull();
    expect(readReadAloudProjection({ mode: 'sing', prompts: [] })).toBeNull();
  });
});

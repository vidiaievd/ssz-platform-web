import { describe, expect, it } from 'vitest';

import { sampleContent, setAnswering } from '@/lib/shared-kernel/information-transfer';

import { readInformationTransferProjection } from './information-transfer-projection';
import { dealInf } from './information-transfer-test-kit';

const clone = () => JSON.parse(JSON.stringify(dealInf())) as ReturnType<typeof dealInf>;

describe('readInformationTransferProjection', () => {
  it('reads a blank as the kernel deals it, text source', () => {
    expect(readInformationTransferProjection(dealInf())).toEqual(dealInf());
  });

  it('reads a blank as the kernel deals it, recording source', () => {
    const audio = dealInf(sampleContent('audio'));
    const read = readInformationTransferProjection(audio);
    expect(read?.sourceKind).toBe('audio');
    expect(read?.passage).toBeUndefined();
    expect(read).toEqual(audio);
  });

  it('keeps the placeholder the pack gave an empty cell', () => {
    const read = readInformationTransferProjection(dealInf());
    expect(read?.fields.find((f) => f.type === 'time')?.placeholder).toBe('kl.');
  });

  it('keeps a printed hint, which only exists when the author printed it from the start', () => {
    // «after one attempt» is the default: the hints are not in the projection.
    expect(readInformationTransferProjection(dealInf())?.fields.some((f) => f.hint)).toBe(false);
    const printed = dealInf(setAnswering(sampleContent('text'), { hintsAfter: 0 }));
    expect(readInformationTransferProjection(printed)?.fields.some((f) => f.hint)).toBe(true);
  });

  it('falls back to safe delivery settings for what did not arrive', () => {
    const blank = { ...clone(), answering: {} };
    expect(readInformationTransferProjection(blank)?.answering).toEqual({
      showSource: 'always',
      oneAtATime: false,
      attempts: 1,
      revealKey: 'afterLastAttempt',
      hintsAfter: 9,
    });
  });

  it.each([
    ['not an object', 'nope'],
    ['an array', []],
    ['no fields', { ...clone(), fields: undefined }],
    ['an unknown source', { ...clone(), sourceKind: 'video' }],
    ['a text source with no text', { ...clone(), passage: '  ' }],
    ['a field of an unknown type', { ...clone(), fields: [{ id: 'a', label: 'A', type: 'x' }] }],
    ['a field with no id', { ...clone(), fields: [{ id: '', label: 'A', type: 'word' }] }],
  ])('refuses %s', (_name, value) => {
    expect(readInformationTransferProjection(value)).toBeNull();
  });

  // The key is refused, never stripped (INF-S): a runner that quietly worked on a payload
  // carrying the answers would hide that they had been sent.
  type Blank = {
    fields: Record<string, unknown>[];
    answering: Record<string, unknown>;
    [key: string]: unknown;
  };
  it.each([
    ['expected on a field', (b: Blank) => (b.fields[0]!['expected'] = ['x'])],
    ['why on a field', (b: Blank) => (b.fields[0]!['why'] = 'x')],
    ['required on a field', (b: Blank) => (b.fields[0]!['required'] = true)],
    ['focus on a field', (b: Blank) => (b.fields[0]!['focus'] = 'x')],
    ['the pass mark', (b: Blank) => (b.answering['passPct'] = 75)],
    ['the grading block', (b: Blank) => (b['grading'] = {})],
    ['the scoring block', (b: Blank) => (b['scoring'] = { passPct: 75 })],
    ['an answer key', (b: Blank) => (b['expectedAnswers'] = {})],
  ])('refuses %s', (_name, mutate) => {
    const blank = clone() as unknown as Blank;
    mutate(blank);
    expect(readInformationTransferProjection(blank)).toBeNull();
  });
});

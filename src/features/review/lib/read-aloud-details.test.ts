import { describe, expect, it } from 'vitest';

import { readReadAloudDetails } from './read-aloud-details';

const PROMPT = {
  itemId: 'p1',
  label: 'Avsnitt 1',
  material: { kind: 'read', text: 'Jeg søker stillingen.' },
  note: 'Trykket.',
  focus: [{ id: 'f1', word: 'stillingen', note: 'to stavelser' }],
  minSeconds: 15,
  maxSeconds: 60,
  recording: { assetId: 'a1', seconds: 21.4, takes: 2, discarded: [] },
};

const DETAILS = {
  totalItems: 1,
  passedItems: 0,
  mode: 'read',
  revision: 'once',
  prompts: [PROMPT],
};

describe('readReadAloudDetails', () => {
  it('reads the engine breakdown as it is composed', () => {
    expect(readReadAloudDetails(DETAILS)).toEqual({
      totalItems: 1,
      passedItems: 0,
      mode: 'read',
      revision: 'once',
      prompts: [
        { ...PROMPT, recording: { assetId: 'a1', seconds: 21.4, takes: 2 }, carried: null },
      ],
    });
  });

  it('reads a carried ruling and takes a malformed one for a new prompt (phase 11b)', () => {
    const ruling = { attemptId: 'a0', attempt: 1, points: 6, max: 6, comment: 'Fin.', marks: {} };
    const read = (carried: unknown) =>
      readReadAloudDetails({ ...DETAILS, prompts: [{ ...PROMPT, carried }] })?.prompts[0]?.carried;
    expect(read(ruling)).toEqual({ attempt: 1, points: 6, max: 6, comment: 'Fin.' });
    expect(read({ ...ruling, attempt: 0 })).toBeNull();
    expect(read('x')).toBeNull();
  });

  it('defaults the revision of a breakdown from before it was carried', () => {
    const { revision: _gone, ...older } = DETAILS;
    expect(readReadAloudDetails(older)?.revision).toBe('return');
  });

  it('keeps a prompt whose material the author has since deleted', () => {
    const read = readReadAloudDetails({ ...DETAILS, prompts: [{ ...PROMPT, material: null }] });
    expect(read?.prompts[0]?.material).toBeNull();
  });

  it('reads the monologue and the dialogue material', () => {
    const monologue = readReadAloudDetails({
      ...DETAILS,
      mode: 'monologue',
      prompts: [
        {
          ...PROMPT,
          material: {
            kind: 'monologue',
            image: { assetId: 'img', caption: 'Et kontor', alt: '' },
            plan: [{ id: 'x', text: 'Hvem', required: true }],
          },
        },
      ],
    });
    expect(monologue?.prompts[0]?.material).toEqual({
      kind: 'monologue',
      image: { assetId: 'img', caption: 'Et kontor', alt: '' },
      plan: [{ id: 'x', text: 'Hvem', required: true }],
    });

    const dialogue = readReadAloudDetails({
      ...DETAILS,
      mode: 'dialogue',
      prompts: [
        { ...PROMPT, material: { kind: 'dialogue', situation: 'I resepsjonen', partner: 'Hei!' } },
      ],
    });
    expect(dialogue?.prompts[0]?.material).toEqual({
      kind: 'dialogue',
      situation: 'I resepsjonen',
      partner: 'Hei!',
    });
  });

  it('refuses whole: one unreadable prompt is a recording nobody could mark', () => {
    const broken = { ...PROMPT, recording: { seconds: 3 } };
    expect(readReadAloudDetails({ ...DETAILS, prompts: [PROMPT, broken] })).toBeNull();
    expect(readReadAloudDetails({ ...DETAILS, prompts: [] })).toBeNull();
    expect(readReadAloudDetails({ ...DETAILS, mode: 'sing' })).toBeNull();
    expect(readReadAloudDetails({ wordCount: 120, paragraphs: 3 })).toBeNull();
    expect(readReadAloudDetails(null)).toBeNull();
  });
});

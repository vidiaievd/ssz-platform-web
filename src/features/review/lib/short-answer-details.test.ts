import { describe, expect, it } from 'vitest';

import { readShortAnswerDetails } from './short-answer-details';

/** As `short-answer.validator.ts` writes it: two questions, one closed, one routed. */
const details = {
  totalItems: 2,
  routedItems: 1,
  passedItems: 1,
  coveredElements: 2,
  totalElements: 3,
  items: [
    {
      itemId: 'q1',
      prompt: 'Hva må alle syklister ha?',
      submitted: 'Alle må ha lys foran og bak.',
      verdict: 'pass',
      covered: 1,
      total: 1,
      tooShort: false,
      words: 6,
      elements: [{ id: 'e1', label: 'lys', required: true, hit: true, anchor: 'lys foran' }],
      model: 'Alle syklister må ha lys foran og bak.',
      routing: 'pass',
    },
    {
      itemId: 'q2',
      prompt: 'Er det lurt å sykle om vinteren?',
      submitted: 'Nei. Kanskje.',
      verdict: 'partial',
      covered: 1,
      total: 2,
      tooShort: true,
      words: 2,
      elements: [
        { id: 'e2', label: 'nei', required: true, hit: true, anchor: 'nei' },
        { id: 'e3', label: 'glatt om vinteren', required: true, hit: false, anchor: null },
      ],
      model: 'Nei, fordi det er glatt om vinteren.',
      routing: 'teacher',
    },
  ],
};

/** The old single-question form — 144 exercises still live, and no `items` anywhere. */
const legacyDetails = {
  matched: null,
  target: 'Han sa at han var trøtt.',
  distance: 2,
  counts: { extra: 1, missing: 1 },
  tokens: [{ t: 'missing', w: 'sa' }],
};

describe('readShortAnswerDetails', () => {
  it("reads the engine's own breakdown through unchanged", () => {
    expect(readShortAnswerDetails(details)).toEqual(details);
  });

  it('refuses the old single-question form rather than reading it as an empty set', () => {
    expect(readShortAnswerDetails(legacyDetails)).toBeNull();
    expect(readShortAnswerDetails(null)).toBeNull();
    expect(readShortAnswerDetails([])).toBeNull();
    expect(readShortAnswerDetails('short answer')).toBeNull();
  });

  it('keeps a question the author has since deleted, with nothing claimed about it', () => {
    const read = readShortAnswerDetails({
      ...details,
      items: [
        {
          itemId: 'gone',
          prompt: null,
          submitted: 'Et helt fornuftig svar.',
          verdict: null,
          covered: 0,
          total: 0,
          tooShort: false,
          words: 4,
          elements: [],
          model: null,
          routing: 'teacher',
        },
      ],
    });

    expect(read).not.toBeNull();
    expect(read!.items[0]).toMatchObject({ itemId: 'gone', verdict: null, prompt: null });
  });

  // The whole point of §6.7: one unreadable question refuses the whole breakdown, so the
  // screen falls back to the answer as it was handed in. Dropping the row instead would
  // leave a tally counting questions that are no longer on screen.
  it('refuses the whole set when one question does not parse', () => {
    const [first, second] = details.items;

    expect(
      readShortAnswerDetails({ ...details, items: [first, { ...second, covered: undefined }] }),
    ).toBeNull();
    expect(
      readShortAnswerDetails({ ...details, items: [first, { ...second, elements: undefined }] }),
    ).toBeNull();
    expect(
      readShortAnswerDetails({ ...details, items: [first, { ...second, submitted: null }] }),
    ).toBeNull();
    expect(
      readShortAnswerDetails({ ...details, items: [first, { ...second, itemId: '' }] }),
    ).toBeNull();
  });

  it('refuses a verdict or a routing it does not recognise', () => {
    const [first] = details.items;

    expect(
      readShortAnswerDetails({ ...details, items: [{ ...first, verdict: 'near' }] }),
    ).toBeNull();
    // `auto` was this validator's word for `pass` before the vocabularies were reconciled.
    // Nothing stored says it — the breakdown is recomputed on every read — and a routing
    // this screen cannot place must not be drawn as "the machine closed it".
    expect(
      readShortAnswerDetails({ ...details, items: [{ ...first, routing: 'auto' }] }),
    ).toBeNull();
  });

  it('refuses a tally it cannot state, rather than printing a zero', () => {
    expect(readShortAnswerDetails({ ...details, coveredElements: undefined })).toBeNull();
    expect(readShortAnswerDetails({ ...details, totalElements: 'three' })).toBeNull();
    expect(readShortAnswerDetails({ ...details, routedItems: -1 })).toBeNull();
  });

  it('takes an empty set as an empty set: a submission with nothing answered', () => {
    const read = readShortAnswerDetails({
      totalItems: 0,
      routedItems: 0,
      passedItems: 0,
      coveredElements: 0,
      totalElements: 0,
      items: [],
    });

    expect(read).not.toBeNull();
    expect(read!.items).toEqual([]);
  });

  it('drops an element the author left half-written rather than the question with it', () => {
    const [first] = details.items;
    const read = readShortAnswerDetails({
      ...details,
      items: [{ ...first, elements: [{ id: 'e1', label: '', required: false, hit: false }] }],
    });

    expect(read).not.toBeNull();
    expect(read!.items[0]!.elements[0]).toEqual({
      id: 'e1',
      label: '',
      required: false,
      hit: false,
      anchor: null,
    });
  });
});

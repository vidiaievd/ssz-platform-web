import { beforeEach, describe, expect, it } from 'vitest';

import { useReviewDraftsStore } from './review-drafts';

const store = () => useReviewDraftsStore.getState();

beforeEach(() => {
  localStorage.clear();
  useReviewDraftsStore.setState({ drafts: {} });
});

describe('review drafts', () => {
  it('keeps what was written about one submission while the reviewer looks at another', () => {
    store().setComment('att-1', 'Se på perfektum her.');
    store().setComment('att-2', 'Bra jobbet.');

    expect(store().drafts['att-1']?.comment).toBe('Se på perfektum her.');
    expect(store().drafts['att-2']?.comment).toBe('Bra jobbet.');
  });

  it('survives the page being left, because it is written where a reload can find it', () => {
    store().setComment('att-1', 'Se på perfektum her.');

    expect(localStorage.getItem('ssz:review:drafts:v1')).toContain('Se på perfektum her.');
  });

  it('is emptied by the reviewer’s own verdict and by nothing else (criterion 15)', () => {
    store().setComment('att-1', 'Se på perfektum her.');
    store().setSentenceComment('att-1', 'i2', '«bor» er presens.');

    // A colleague deciding first must leave every word of this alone: it is the only
    // thing the reviewer has left to copy out of a read-only screen.
    expect(store().drafts['att-1']?.sentences.i2).toBe('«bor» er presens.');

    store().clear('att-1');
    expect(store().drafts['att-1']).toBeUndefined();
  });

  it('takes a sentence comment off when it is removed rather than storing a blank', () => {
    store().setSentenceComment('att-1', 'i2', 'Feil tid.');
    store().setSentenceComment('att-1', 'i2', undefined);

    expect(store().drafts['att-1']).toBeUndefined();
  });

  it('forgets the least recently touched once too many pile up', () => {
    for (let n = 0; n < 41; n += 1) store().setComment(`att-${n}`, `note ${n}`);

    expect(store().drafts['att-0']).toBeUndefined();
    expect(store().drafts['att-40']?.comment).toBe('note 40');
    expect(Object.keys(store().drafts)).toHaveLength(40);
  });
});

describe('rubric marks', () => {
  it('holds one mark per criterion and changes it in place', () => {
    store().setMark('att-1', 'c-task', 2);
    store().setMark('att-1', 'c-lang', 1);
    store().setMark('att-1', 'c-task', 3);

    expect(store().drafts['att-1']?.marks).toEqual({ 'c-task': 3, 'c-lang': 1 });
  });

  // The reason marks live here rather than in the panel: a filled rubric is four
  // judgements made while reading a text once, and a conflict must not cost the reading.
  it('is kept by everything except the reviewer’s own verdict', () => {
    store().setMark('att-1', 'c-task', 2);

    expect(localStorage.getItem('ssz:review:drafts:v1')).toContain('c-task');

    store().clear('att-1');
    expect(store().drafts['att-1']).toBeUndefined();
  });

  it('keeps a draft that holds only marks — no comment is not no work', () => {
    store().setMark('att-1', 'c-task', 0);

    expect(store().drafts['att-1']).toBeDefined();
  });

  it('gives a draft stored before marks existed an empty set rather than dropping it', async () => {
    localStorage.setItem(
      'ssz:review:drafts:v1',
      JSON.stringify({
        version: 1,
        state: { drafts: { 'att-9': { comment: 'Bra.', sentences: {}, touchedAt: 5 } } },
      }),
    );

    await useReviewDraftsStore.persist.rehydrate();

    expect(store().drafts['att-9']).toEqual({
      comment: 'Bra.',
      sentences: {},
      marks: {},
      touchedAt: 5,
    });
  });
});

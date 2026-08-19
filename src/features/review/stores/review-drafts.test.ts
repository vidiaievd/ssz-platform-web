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

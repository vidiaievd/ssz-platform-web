import { describe, expect, it } from 'vitest';

import { deferPosition, nextPosition } from './sentence-set-order';

const IDS = ['r1', 'r2', 'r3'];
const nothingClosed = () => false;

describe('nextPosition', () => {
  it('walks forward while there is something ahead', () => {
    expect(nextPosition({ ids: IDS, index: 0, isClosed: nothingClosed, deferred: [] })).toEqual({
      index: 1,
      deferred: [],
    });
  });

  it('steps over sentences already finished', () => {
    expect(
      nextPosition({ ids: IDS, index: 0, isClosed: (id) => id === 'r2', deferred: [] }),
    ).toEqual({ index: 2, deferred: [] });
  });

  it('comes back to a deferred sentence once nothing is left ahead', () => {
    expect(nextPosition({ ids: IDS, index: 2, isClosed: nothingClosed, deferred: ['r1'] })).toEqual(
      { index: 0, deferred: [] },
    );
  });

  it('does not offer a deferred sentence while unseen ones remain', () => {
    // r1 was put aside on the way past; r3 has never been seen, so it goes first.
    expect(nextPosition({ ids: IDS, index: 1, isClosed: nothingClosed, deferred: ['r1'] })).toEqual(
      { index: 2, deferred: ['r1'] },
    );
  });

  it('takes the deferred ones oldest first', () => {
    expect(
      nextPosition({ ids: IDS, index: 2, isClosed: nothingClosed, deferred: ['r2', 'r1'] }),
    ).toEqual({ index: 1, deferred: ['r1'] });
  });

  it('drops a deferred sentence the set no longer has', () => {
    expect(
      nextPosition({ ids: IDS, index: 2, isClosed: nothingClosed, deferred: ['gone', 'r1'] }),
    ).toEqual({ index: 0, deferred: [] });
  });

  it('ends the set when nothing is left in either direction', () => {
    expect(nextPosition({ ids: IDS, index: 2, isClosed: nothingClosed, deferred: [] })).toEqual({
      index: null,
      deferred: [],
    });
  });
});

describe('deferPosition', () => {
  it('sends the current sentence to the back and moves on', () => {
    expect(
      deferPosition({ ids: IDS, index: 0, isClosed: nothingClosed, deferred: [] }, []),
    ).toEqual({ index: 1, deferred: ['r1'] });
  });

  it('will not queue the same sentence twice — the second refusal is final', () => {
    // r1 has been round once already: skipping it now moves past it for good.
    expect(
      deferPosition({ ids: IDS, index: 0, isClosed: nothingClosed, deferred: [] }, ['r1']),
    ).toEqual({ index: 1, deferred: [] });
  });

  it('ends the set when the last sentence is refused a second time', () => {
    expect(
      deferPosition({ ids: IDS, index: 2, isClosed: nothingClosed, deferred: [] }, ['r3']),
    ).toEqual({ index: null, deferred: [] });
  });
});

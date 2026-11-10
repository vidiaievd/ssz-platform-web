import { describe, expect, it } from 'vitest';

import {
  TransitionError,
  isSeatsExhaustedTransition,
  isTransitionConflict,
} from './use-transition-membership';

describe('transition errors', () => {
  it('tells "no seats left" from "someone handled it first"', () => {
    const seats = new TransitionError('Seats exhausted', 409, 'SEATS_EXHAUSTED');
    const handled = new TransitionError('conflict', 409);

    expect(isSeatsExhaustedTransition(seats)).toBe(true);
    expect(isTransitionConflict(seats)).toBe(false);

    expect(isSeatsExhaustedTransition(handled)).toBe(false);
    expect(isTransitionConflict(handled)).toBe(true);
  });

  it('ignores other statuses and foreign errors', () => {
    expect(isSeatsExhaustedTransition(new TransitionError('x', 500, 'SEATS_EXHAUSTED'))).toBe(false);
    expect(isTransitionConflict(new Error('x'))).toBe(false);
  });
});

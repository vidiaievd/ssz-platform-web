import { describe, expect, it } from 'vitest';

import { isSeatsExhausted, seatsExhaustedResponseBody, seatsFromConflictBody } from './seats-error';

const body = {
  error: {
    code: 'SEATS_EXHAUSTED',
    message: 'no seats',
    seats: { used: 110, limit: 100, ceiling: 110, state: 'full' },
  },
};

describe('seats refusal', () => {
  it('reads the usage out of the 409 body', () => {
    expect(seatsFromConflictBody(body)).toEqual({ used: 110, limit: 100, ceiling: 110, state: 'full' });
  });

  it('is null for any other conflict or a malformed body', () => {
    expect(seatsFromConflictBody({ error: { code: 'ALREADY_MEMBER' } })).toBeNull();
    expect(seatsFromConflictBody({ error: { code: 'SEATS_EXHAUSTED' } })).toBeNull();
    expect(seatsFromConflictBody(null)).toBeNull();
    expect(seatsFromConflictBody('x')).toBeNull();
  });

  it('recognises it on an AppError-shaped value', () => {
    expect(isSeatsExhausted({ code: 'conflict', details: body })).toBe(true);
    expect(isSeatsExhausted({ code: 'conflict', details: { error: { code: 'X' } } })).toBe(false);
    expect(isSeatsExhausted(new Error('x'))).toBe(false);
  });

  it('builds the browser-facing body', () => {
    expect(seatsExhaustedResponseBody({ details: body })).toMatchObject({ code: 'SEATS_EXHAUSTED', seats: { used: 110 } });
    expect(seatsExhaustedResponseBody({ details: null })).toBeNull();
  });
});

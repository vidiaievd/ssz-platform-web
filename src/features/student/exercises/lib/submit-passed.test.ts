import { describe, expect, it } from 'vitest';

import { submitPassed } from './submit-passed';

describe('submitPassed (plan 90, OQ-S3 s11)', () => {
  it('a set over the pass mark with an item wrong is passed', () => {
    expect(submitPassed({ correct: false, passed: true })).toBe(true);
  });

  it("the engine's verdict wins over `correct`", () => {
    expect(submitPassed({ correct: true, passed: false })).toBe(false);
  });

  it('an engine that does not say falls back to `correct`', () => {
    expect(submitPassed({ correct: false })).toBe(false);
    expect(submitPassed({ correct: true })).toBe(true);
  });
});

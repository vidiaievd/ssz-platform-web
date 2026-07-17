import { describe, expect, it } from 'vitest';

import { formatTimecode } from './format-timecode';

describe('formatTimecode', () => {
  it('formats whole seconds under a minute', () => {
    expect(formatTimecode(18)).toBe('0:18');
  });

  it('floors fractional seconds', () => {
    expect(formatTimecode(142.7)).toBe('2:22');
  });

  it('pads seconds under 10', () => {
    expect(formatTimecode(65)).toBe('1:05');
  });

  it('clamps negative input to zero', () => {
    expect(formatTimecode(-5)).toBe('0:00');
  });
});

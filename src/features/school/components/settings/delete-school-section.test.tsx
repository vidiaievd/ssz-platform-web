import { describe, expect, it } from 'vitest';

import { nameMatches } from './delete-school-section';

describe('nameMatches', () => {
  it('accepts the name ignoring case and surrounding spaces', () => {
    expect(nameMatches('  nordick ', 'Nordick')).toBe(true);
  });
  it('refuses a different or empty name', () => {
    expect(nameMatches('Nordic', 'Nordick')).toBe(false);
    expect(nameMatches('', '')).toBe(false);
  });
});

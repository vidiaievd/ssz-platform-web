import { describe, expect, it } from 'vitest';

import { getGlossaryMode } from './glossary-mode';

describe('getGlossaryMode', () => {
  it.each(['A1', 'A2', 'B1'])('returns translation for %s', (level) => {
    expect(getGlossaryMode(level)).toBe('translation');
  });

  it.each(['B2', 'C1', 'C2'])('returns definition for %s', (level) => {
    expect(getGlossaryMode(level)).toBe('definition');
  });
});

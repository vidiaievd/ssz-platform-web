import { describe, expect, it } from 'vitest';

import { stripLevelPrefix } from './structure-nodes';

describe('stripLevelPrefix', () => {
  it('drops the numbered prefix an author typed into the title', () => {
    expect(stripLevelPrefix('Leksjon 1 — Arbeidsliv')).toBe('Arbeidsliv');
  });

  it.each([
    ['Level 2 - Utdanning', 'Utdanning'],
    ['Unit 3: Bolig og økonomi', 'Bolig og økonomi'],
    ['Урок 4. Здоровье', 'Здоровье'],
    ['Leksjon 10 – Helse', 'Helse'],
  ])('handles %s', (input, expected) => {
    expect(stripLevelPrefix(input)).toBe(expected);
  });

  it('keeps a title that has no such prefix', () => {
    expect(stripLevelPrefix('A1 — Beginner')).toBe('A1 — Beginner');
  });

  it('keeps the whole title when stripping would leave nothing to show', () => {
    expect(stripLevelPrefix('Leksjon 1')).toBe('Leksjon 1');
    expect(stripLevelPrefix('Leksjon 1 — ')).toBe('Leksjon 1 — ');
  });

  it('renders an untitled level as an empty label rather than "null"', () => {
    expect(stripLevelPrefix(null)).toBe('');
  });
});

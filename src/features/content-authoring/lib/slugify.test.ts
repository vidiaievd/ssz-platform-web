import { describe, expect, it } from 'vitest';

import { slugify } from './slugify';

describe('slugify', () => {
  it('lowercases and hyphenates', () => {
    expect(slugify('Norsk for beginners')).toBe('norsk-for-beginners');
  });

  it('collapses non-alphanumeric runs into a single hyphen', () => {
    expect(slugify('Norsk — A1/A2!!')).toBe('norsk-a1-a2');
  });

  it('trims leading and trailing hyphens', () => {
    expect(slugify('  ¡Hola!  ')).toBe('hola');
  });

  it('returns an empty string for an empty title', () => {
    expect(slugify('')).toBe('');
  });
});

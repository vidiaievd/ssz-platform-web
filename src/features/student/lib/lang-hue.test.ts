import { describe, expect, it } from 'vitest';

import { langHue } from './lang-hue';

describe('langHue', () => {
  it('returns distinct hue-tinted tokens for a known language code', () => {
    const nb = langHue('nb');
    expect(nb.c).toBe('oklch(0.62 0.105 200)');
    expect(nb.soft).toBe('oklch(0.93 0.05 200)');
    expect(nb.mid).toBe('oklch(0.79 0.09 200)');
    expect(nb.deep).toBe('oklch(0.44 0.09 200)');
  });

  it('is case-insensitive', () => {
    expect(langHue('NB')).toEqual(langHue('nb'));
  });

  it('gives every documented language a different hue from its neighbours', () => {
    const hues = ['es', 'fr', 'de', 'ja', 'uk'].map((code) => langHue(code).c);
    expect(new Set(hues).size).toBe(hues.length);
  });

  it('falls back to the English hue for an unrecognised language code', () => {
    expect(langHue('xx')).toEqual(langHue('en'));
  });
});

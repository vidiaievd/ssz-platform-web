import { describe, expect, it } from 'vitest';

import { langHue } from './lang-hue';

describe('langHue', () => {
  it('returns distinct hue-tinted tokens for a known language code', () => {
    const nb = langHue('nb');
    expect(nb.c).toBe('oklch(var(--ssz-lang-c-lc) 200)');
    expect(nb.soft).toBe('oklch(var(--ssz-lang-soft-lc) 200)');
    expect(nb.mid).toBe('oklch(var(--ssz-lang-mid-lc) 200)');
    expect(nb.deep).toBe('oklch(var(--ssz-lang-deep-lc) 200)');
    expect(nb.ink).toBe('oklch(0.44 0.09 200)');
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

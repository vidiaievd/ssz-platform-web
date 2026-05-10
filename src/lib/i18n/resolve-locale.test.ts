import { describe, expect, it } from 'vitest';

import { resolveLocale } from './resolve-locale';

describe('resolveLocale', () => {
  it('prefers a valid cookie', () => {
    expect(resolveLocale({ cookie: 'uk', acceptLanguage: 'ru' })).toBe('uk');
  });

  it('ignores an unsupported cookie', () => {
    expect(resolveLocale({ cookie: 'de', acceptLanguage: 'en' })).toBe('en');
  });

  it('forces uk for Ukrainian visitors regardless of Accept-Language', () => {
    expect(resolveLocale({ country: 'UA', acceptLanguage: 'ru' })).toBe('uk');
  });

  it('forces nb for Norwegian visitors', () => {
    expect(resolveLocale({ country: 'NO', acceptLanguage: 'en' })).toBe('nb');
  });

  it('falls back to Accept-Language when no country override applies', () => {
    expect(resolveLocale({ acceptLanguage: 'nb-NO,nb;q=0.9,en;q=0.8' })).toBe('nb');
  });

  it('uses the default when nothing matches', () => {
    expect(resolveLocale({ acceptLanguage: 'de-DE,de;q=0.9' })).toBe('en');
  });
});

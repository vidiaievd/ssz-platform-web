import { describe, expect, it } from 'vitest';
import { fitsGroupLanguage } from './language-fit';

describe('fitsGroupLanguage', () => {
  it('fits a teacher who lists the group language, in any case', () => {
    expect(fitsGroupLanguage(['en', 'NB'], 'nb')).toBe(true);
  });

  it('does not fit a teacher who lists other languages only', () => {
    expect(fitsGroupLanguage(['en', 'uk'], 'nb')).toBe(false);
  });

  it('does not mark a teacher who listed no language (the server does not check them)', () => {
    expect(fitsGroupLanguage([], 'nb')).toBe(true);
  });
});

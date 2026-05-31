import { describe, it, expect } from 'vitest';
import { generateSlug } from './slug';

describe('generateSlug', () => {
  it('handles a plain latin name', () => {
    expect(generateSlug('John Smith')).toBe('john-smith');
  });

  it('strips accents from latin characters', () => {
    expect(generateSlug('Søren Ångström')).toBe('soren-angstrom');
  });

  it('transliterates a Cyrillic-only name (Ukrainian)', () => {
    expect(generateSlug('Анна Іваненко')).toBe('anna-ivanenko');
  });

  it('transliterates a Cyrillic-only name (Russian)', () => {
    expect(generateSlug('Иван Петров')).toBe('ivan-petrov');
  });

  it('handles mixed latin + Cyrillic', () => {
    expect(generateSlug('Ivan Іваненко')).toBe('ivan-ivanenko');
  });

  it('returns empty string for emoji-only input with no fallback', () => {
    expect(generateSlug('🎉🔥')).toBe('');
  });

  it('returns fallbackId when slug is empty', () => {
    expect(generateSlug('🎉🔥', 'user-42')).toBe('user-42');
  });

  it('returns fallbackId when name is an empty string', () => {
    expect(generateSlug('', 'fallback')).toBe('fallback');
  });

  it('ignores fallbackId when slug resolves non-empty', () => {
    expect(generateSlug('Alice', 'fallback')).toBe('alice');
  });

  it('caps the slug at 60 characters', () => {
    const long = 'a'.repeat(100);
    expect(generateSlug(long)).toHaveLength(60);
  });

  it('trims leading and trailing dashes', () => {
    expect(generateSlug('  --hello--  ')).toBe('hello');
  });

  it('collapses consecutive separators into one dash', () => {
    expect(generateSlug('hello   world')).toBe('hello-world');
  });
});

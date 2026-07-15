import { describe, expect, it } from 'vitest';

import {
  findAudioNarration,
  findHeroImage,
  removeAudioNarration,
  removeHeroImage,
  setAudioNarration,
  setHeroImage,
} from './lesson-media-tokens';

describe('hero image token', () => {
  it('finds no image in plain text', () => {
    expect(findHeroImage('Just some text.')).toBeNull();
  });

  it('finds the first image token and its alt text', () => {
    const body = 'Intro.\n\n![A busy workday](media://media-1)\n\nMore text.';
    expect(findHeroImage(body)).toEqual({ alt: 'A busy workday', mediaId: 'media-1' });
  });

  it('inserts a new token at the top when none exists', () => {
    const result = setHeroImage('Existing body.', 'media-1', 'Alt text');
    expect(result).toBe('![Alt text](media://media-1)\n\nExisting body.');
  });

  it('inserts a bare token when the body is empty', () => {
    expect(setHeroImage('', 'media-1', 'Alt text')).toBe('![Alt text](media://media-1)');
  });

  it('replaces an existing token in place, preserving surrounding text', () => {
    const body = 'Intro.\n\n![Old alt](media://old-id)\n\nMore text.';
    const result = setHeroImage(body, 'new-id', 'New alt');
    expect(result).toBe('Intro.\n\n![New alt](media://new-id)\n\nMore text.');
  });

  it('removes the token and collapses the resulting leading blank lines', () => {
    const body = '![Alt text](media://media-1)\n\nExisting body.';
    expect(removeHeroImage(body)).toBe('Existing body.');
  });

  it('removeHeroImage is a no-op when there is no token', () => {
    expect(removeHeroImage('Existing body.')).toBe('Existing body.');
  });
});

describe('audio narration token', () => {
  it('finds no narration in plain text', () => {
    expect(findAudioNarration('Just some text.')).toBeNull();
  });

  it('finds a labeled narration token', () => {
    const body = 'Text.\n\n[audio:media-2 "Narration"]';
    expect(findAudioNarration(body)).toEqual({ mediaId: 'media-2', label: 'Narration' });
  });

  it('finds an unlabeled narration token', () => {
    expect(findAudioNarration('[audio:media-2]')).toEqual({ mediaId: 'media-2', label: null });
  });

  it('appends a new token at the end when none exists', () => {
    expect(setAudioNarration('Existing body.', 'media-2', 'Narration')).toBe(
      'Existing body.\n\n[audio:media-2 "Narration"]',
    );
  });

  it('appends a bare token when the body is empty', () => {
    expect(setAudioNarration('', 'media-2', null)).toBe('[audio:media-2]');
  });

  it('replaces an existing token in place', () => {
    const body = 'Text.\n\n[audio:old-id "Old"]\n\nMore.';
    expect(setAudioNarration(body, 'new-id', 'New')).toBe('Text.\n\n[audio:new-id "New"]\n\nMore.');
  });

  it('removes the token and trims trailing whitespace', () => {
    expect(removeAudioNarration('Existing body.\n\n[audio:media-2 "Narration"]')).toBe(
      'Existing body.',
    );
  });
});

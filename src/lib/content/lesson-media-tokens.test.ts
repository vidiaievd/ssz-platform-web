import { describe, expect, it } from 'vitest';

import {
  findAudioNarration,
  findHeroImage,
  imageToken,
  isShownOutsideProse,
  findVideoSource,
  isMediaOnlyParagraph,
  removeAudioNarration,
  removeHeroImage,
  removeVideoSource,
  setAudioNarration,
  setHeroImage,
  setVideoSource,
} from './lesson-media-tokens';

describe('hero image token', () => {
  it('finds no image in plain text', () => {
    expect(findHeroImage('Just some text.')).toBeNull();
  });

  it('finds the image token that opens the body, and its alt text', () => {
    const body = '![A busy workday](media://media-1)\n\nIntro.\n\nMore text.';
    expect(findHeroImage(body)).toEqual({ alt: 'A busy workday', mediaId: 'media-1' });
  });

  it('inserts a new token at the top when none exists', () => {
    const result = setHeroImage('Existing body.', 'media-1', 'Alt text');
    expect(result).toBe('![Alt text](media://media-1)\n\nExisting body.');
  });

  it('inserts a bare token when the body is empty', () => {
    expect(setHeroImage('', 'media-1', 'Alt text')).toBe('![Alt text](media://media-1)');
  });

  it('replaces an existing cover in place, preserving the text after it', () => {
    const body = '![Old alt](media://old-id)\n\nIntro.\n\nMore text.';
    const result = setHeroImage(body, 'new-id', 'New alt');
    expect(result).toBe('![New alt](media://new-id)\n\nIntro.\n\nMore text.');
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

describe('video source token', () => {
  it('finds no source in plain text', () => {
    expect(findVideoSource('Just some text.')).toBeNull();
  });

  it('finds the video token and its media ID', () => {
    const body = 'Intro.\n\n[video:media-3]\n\nMore text.';
    expect(findVideoSource(body)).toEqual({ mediaId: 'media-3' });
  });

  it('inserts a new token at the top when none exists', () => {
    expect(setVideoSource('Existing body.', 'media-3')).toBe('[video:media-3]\n\nExisting body.');
  });

  it('inserts a bare token when the body is empty', () => {
    expect(setVideoSource('', 'media-3')).toBe('[video:media-3]');
  });

  it('replaces an existing token in place, preserving surrounding text', () => {
    const body = 'Intro.\n\n[video:old-id]\n\nMore text.';
    expect(setVideoSource(body, 'new-id')).toBe('Intro.\n\n[video:new-id]\n\nMore text.');
  });

  it('removes the token and collapses the resulting leading blank lines', () => {
    const body = '[video:media-3]\n\nExisting body.';
    expect(removeVideoSource(body)).toBe('Existing body.');
  });

  it('removeVideoSource is a no-op when there is no token', () => {
    expect(removeVideoSource('Existing body.')).toBe('Existing body.');
  });
});

describe('isMediaOnlyParagraph', () => {
  it('is true for a paragraph that is only a hero image token', () => {
    expect(isMediaOnlyParagraph('![Alt text](media://media-1)')).toBe(true);
  });

  it('is true for a paragraph that is only an audio narration token', () => {
    expect(isMediaOnlyParagraph('[audio:media-2 "Narration"]')).toBe(true);
  });

  it('is true for a paragraph that is only a video source token', () => {
    expect(isMediaOnlyParagraph('[video:media-3]')).toBe(true);
  });

  it('is false for prose, even if it contains a token plus other text', () => {
    expect(isMediaOnlyParagraph('![Alt text](media://media-1) and some more text')).toBe(false);
    expect(isMediaOnlyParagraph('Just some text.')).toBe(false);
  });
});

describe('images inside the text (not the cover)', () => {
  it('takes only an image that opens the body for the cover', () => {
    const body = 'Taras åpner kontoret.\n\n![Et kontor](media://img-2)';
    expect(findHeroImage(body)).toBeNull();
    // Setting a cover puts it at the top and leaves the image in the text alone.
    expect(setHeroImage(body, 'cover-1', 'Forside')).toBe(`![Forside](media://cover-1)\n\n${body}`);
  });

  it('draws the cover and the players outside the prose, and an image in the text inside it', () => {
    expect(isShownOutsideProse('![Forside](media://cover-1)', 0)).toBe(true);
    expect(isShownOutsideProse('[audio:n-1]', 7)).toBe(true);
    expect(isShownOutsideProse('![Et kontor](media://img-2)', 3)).toBe(false);
    expect(isShownOutsideProse('Taras åpner kontoret.', 0)).toBe(false);
  });

  it('writes an image token whose alt cannot break it', () => {
    expect(imageToken('img-2', 'Et [stort] kontor')).toBe('![Et stort kontor](media://img-2)');
  });
});

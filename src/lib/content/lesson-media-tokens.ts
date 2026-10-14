/**
 * The hero image isn't a separate field — content-service extracts media refs
 * straight out of `body_markdown` via custom protocol tokens
 * (`MarkdownMediaParserService`: `![alt](media://id)` / `[audio:id "label"]` /
 * `[video:id]`). "Hero image" here is an FE convention: a `media://` image token that opens
 * the body, treated as the lesson's single cover image. An image anywhere else is part of the
 * text and is shown where it stands — only the opening one is the cover.
 */
const IMAGE_TOKEN_REGEX = /!\[([^\]]*)\]\(media:\/\/([a-zA-Z0-9_-]+)\)/;
/** The cover: an image token before anything else in the body. */
const HERO_TOKEN_REGEX = new RegExp(`^\\s*${IMAGE_TOKEN_REGEX.source}`);
const AUDIO_TOKEN_REGEX = /\[audio:([a-zA-Z0-9_-]+)(?:\s+"([^"]*)")?\]/;
// No label group — mirrors MarkdownMediaParserService.VIDEO_REGEX exactly.
const VIDEO_TOKEN_REGEX = /\[video:([a-zA-Z0-9_-]+)\]/;

export interface HeroImageToken {
  alt: string;
  mediaId: string;
}

export function findHeroImage(body: string): HeroImageToken | null {
  const match = body.match(HERO_TOKEN_REGEX);
  if (!match) return null;
  return { alt: match[1] ?? '', mediaId: match[2] ?? '' };
}

/** Replaces the existing hero image token in place, or inserts a new one at the top. */
export function setHeroImage(body: string, mediaId: string, alt: string): string {
  const token = `![${alt}](media://${mediaId})`;
  if (HERO_TOKEN_REGEX.test(body)) {
    return body.replace(HERO_TOKEN_REGEX, token);
  }
  return body.trim() ? `${token}\n\n${body}` : token;
}

export function removeHeroImage(body: string): string {
  return body
    .replace(HERO_TOKEN_REGEX, '')
    .replace(/^\s*\n+/, '')
    .trimStart();
}

/** An image token for a picture placed in the text, on a paragraph of its own. */
export function imageToken(mediaId: string, alt: string): string {
  return `![${alt.replace(/[\[\]]/g, '')}](media://${mediaId})`;
}

export interface AudioNarrationToken {
  mediaId: string;
  label: string | null;
}

export function findAudioNarration(body: string): AudioNarrationToken | null {
  const match = body.match(AUDIO_TOKEN_REGEX);
  if (!match) return null;
  return { mediaId: match[1] ?? '', label: match[2] ?? null };
}

/** Replaces the existing narration token in place, or appends a new one at the end. */
export function setAudioNarration(body: string, mediaId: string, label: string | null): string {
  const token = label ? `[audio:${mediaId} "${label}"]` : `[audio:${mediaId}]`;
  if (AUDIO_TOKEN_REGEX.test(body)) {
    return body.replace(AUDIO_TOKEN_REGEX, token);
  }
  return body.trim() ? `${body}\n\n${token}` : token;
}

export function removeAudioNarration(body: string): string {
  return body
    .replace(AUDIO_TOKEN_REGEX, '')
    .replace(/\n+\s*$/, '')
    .trimEnd();
}

export interface VideoSourceToken {
  mediaId: string;
}

export function findVideoSource(body: string): VideoSourceToken | null {
  const match = body.match(VIDEO_TOKEN_REGEX);
  if (!match) return null;
  return { mediaId: match[1] ?? '' };
}

/** Replaces the existing video token in place, or inserts a new one at the top. */
export function setVideoSource(body: string, mediaId: string): string {
  const token = `[video:${mediaId}]`;
  if (VIDEO_TOKEN_REGEX.test(body)) {
    return body.replace(VIDEO_TOKEN_REGEX, token);
  }
  return body.trim() ? `${token}\n\n${body}` : token;
}

export function removeVideoSource(body: string): string {
  return body
    .replace(VIDEO_TOKEN_REGEX, '')
    .replace(/^\s*\n+/, '')
    .trimStart();
}

const IMAGE_TOKEN_ONLY_REGEX = new RegExp(`^${IMAGE_TOKEN_REGEX.source}$`);
const AUDIO_TOKEN_ONLY_REGEX = new RegExp(`^${AUDIO_TOKEN_REGEX.source}$`);
const VIDEO_TOKEN_ONLY_REGEX = new RegExp(`^${VIDEO_TOKEN_REGEX.source}$`);

/**
 * True when a paragraph (as split by `MarkdownParagraphSplitterService`/
 * `splitParagraphs`) is nothing but a hero-image/audio-narration/video-source
 * token — readers should skip these rather than render them as prose.
 */
export function isMediaOnlyParagraph(paragraph: string): boolean {
  const trimmed = paragraph.trim();
  return (
    IMAGE_TOKEN_ONLY_REGEX.test(trimmed) ||
    AUDIO_TOKEN_ONLY_REGEX.test(trimmed) ||
    VIDEO_TOKEN_ONLY_REGEX.test(trimmed)
  );
}

/**
 * True when the reader draws a paragraph somewhere other than in the prose: the narration and
 * the video have players of their own, and an image that opens the body is the cover. Any
 * other image paragraph is part of the text and is drawn where it stands.
 */
export function isShownOutsideProse(paragraph: string, index: number): boolean {
  const trimmed = paragraph.trim();
  return (
    AUDIO_TOKEN_ONLY_REGEX.test(trimmed) ||
    VIDEO_TOKEN_ONLY_REGEX.test(trimmed) ||
    (index === 0 && IMAGE_TOKEN_ONLY_REGEX.test(trimmed))
  );
}

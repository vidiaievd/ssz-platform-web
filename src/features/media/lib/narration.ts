import type { NarrationRequestResponse } from '../types';

/** Why media-service refused a narration; `null` for anything it did not name. */
export type NarrationRefusal =
  | 'EMPTY_TEXT'
  | 'TEXT_TOO_LONG'
  | 'LANGUAGE_NOT_SUPPORTED'
  | 'VOICE_NOT_AVAILABLE'
  | null;

export class NarrationRequestError extends Error {
  constructor(
    readonly status: number,
    readonly reason: NarrationRefusal,
  ) {
    super(`Narration request failed: ${status}${reason ? ` ${reason}` : ''}`);
    this.name = 'NarrationRequestError';
  }
}

const REFUSALS = new Set([
  'EMPTY_TEXT',
  'TEXT_TOO_LONG',
  'LANGUAGE_NOT_SUPPORTED',
  'VOICE_NOT_AVAILABLE',
]);

/**
 * Ask for a synthesized narration of a lesson body (plan 74). Returns as soon as the job is
 * queued; the asset turns READY once spoken and processed — poll it with `useMediaAsset`.
 */
export async function requestNarration(input: {
  bodyMarkdown: string;
  lang: string;
  label?: string | null;
  lessonId?: string | null;
  /** The course's CEFR level: media-service picks the pace for it. */
  level?: string | null;
  /** The author's own pace and pauses; each falls back to the level's default. */
  lengthScale?: number;
  pauseScale?: number;
  /** The narrator's catalog id; omitted is the language's default voice. */
  voiceId?: string;
  /** Voice per speaker of the dialogue; speakers left out are given voices by media-service. */
  speakerVoices?: Record<string, string>;
}): Promise<NarrationRequestResponse> {
  const res = await fetch('/api/media/narration', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      bodyMarkdown: input.bodyMarkdown,
      lang: input.lang,
      ...(input.label ? { label: input.label } : {}),
      ...(input.lessonId ? { lessonId: input.lessonId } : {}),
      ...(input.level ? { level: input.level } : {}),
      ...(input.lengthScale !== undefined ? { lengthScale: input.lengthScale } : {}),
      ...(input.pauseScale !== undefined ? { pauseScale: input.pauseScale } : {}),
      ...(input.voiceId ? { voiceId: input.voiceId } : {}),
      ...(input.speakerVoices && Object.keys(input.speakerVoices).length > 0
        ? { speakerVoices: input.speakerVoices }
        : {}),
    }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { reason?: unknown } | null;
    const reason =
      typeof body?.reason === 'string' && REFUSALS.has(body.reason)
        ? (body.reason as NarrationRefusal)
        : null;
    throw new NarrationRequestError(res.status, reason);
  }
  return (await res.json()) as NarrationRequestResponse;
}

/**
 * Tell media-service a lesson body now names `byAssetId` instead of `assetId` (D5). The old
 * asset stays playable and restorable; superseding the new one by the old one goes back.
 */
export async function supersedeAsset(assetId: string, byAssetId: string): Promise<void> {
  const res = await fetch(`/api/media/assets/${assetId}/supersede`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ by: byAssetId }),
  });
  if (!res.ok) throw new Error(`Supersede failed: ${res.status}`);
}

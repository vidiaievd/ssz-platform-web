import { uploadAsset } from '@/features/media';
import { createBrowserRecorder, type RecorderPort } from '@/features/student/exercises/recorder';

import { mixDown, type DecodedAudio } from './slice';

/**
 * Where a word's clip comes from — plan 72 §3.4, behind a port.
 *
 * Every source ends the same way: an `exercise_asset` id the document keeps. The length is not
 * any source's answer; it is the media worker's, read off the asset once it is `READY` — a TTS
 * clip comes back before it has been measured, and an upload is measured after it lands. A port
 * so the steps are tested without a network, a microphone or `AudioContext` (jsdom has none).
 */

/** What the builder needs to know about an asset: is it measured, how long, where to hear it. */
export interface ClipAsset {
  /** `READY` — measured and playable; `FAILED` — the worker gave up; anything else — wait. */
  status: 'pending' | 'ready' | 'failed';
  durationMs: number;
  url: string;
}

export interface ClipSources {
  /** A file — a recording, an upload, a slice — into a new asset of the exercise. */
  upload(file: File, exerciseId: string): Promise<string>;
  /** Piper's reading of one word, as a new asset (`POST /media/pronunciation/clip`). */
  synthesize(
    text: string,
    language: string,
    exerciseId: string,
  ): Promise<{ assetId: string; voice: string }>;
  describe(assetId: string): Promise<ClipAsset>;
  /** A fresh microphone. One per step, opened on the first «Record». */
  recorder(): RecorderPort;
  /** A whole session file as mono samples — «Slice one file» (Q3-A). Rejects what is not audio. */
  decode(file: File): Promise<DecodedAudio>;
}

function statusOf(raw: unknown): ClipAsset['status'] {
  if (raw === 'READY') return 'ready';
  if (raw === 'FAILED' || raw === 'DELETED') return 'failed';
  return 'pending';
}

export const browserClipSources: ClipSources = {
  async upload(file, exerciseId) {
    const { asset } = await uploadAsset({ file, purpose: 'exercise', entityId: exerciseId });
    return asset.id;
  },
  async synthesize(text, language, exerciseId) {
    const res = await fetch('/api/media/pronunciation/clip', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, lang: language, exerciseId }),
    });
    if (!res.ok) throw new Error(`Synthesis failed (${res.status})`);
    const body = (await res.json()) as { assetId?: unknown; voice?: unknown };
    if (typeof body.assetId !== 'string') throw new Error('Synthesis answered without an asset');
    return { assetId: body.assetId, voice: typeof body.voice === 'string' ? body.voice : '' };
  },
  async describe(assetId) {
    const res = await fetch(`/api/media/assets/${assetId}`);
    if (!res.ok) throw new Error(`Asset ${assetId} could not be read (${res.status})`);
    const body = (await res.json()) as { status?: unknown; durationMs?: unknown; url?: unknown };
    return {
      status: statusOf(body.status),
      durationMs: typeof body.durationMs === 'number' ? body.durationMs : 0,
      url: typeof body.url === 'string' ? body.url : '',
    };
  },
  recorder: () => createBrowserRecorder(),
  async decode(file) {
    const context = new AudioContext();
    try {
      const buffer = await context.decodeAudioData(await file.arrayBuffer());
      const channels = Array.from({ length: buffer.numberOfChannels }, (_, i) =>
        buffer.getChannelData(i),
      );
      return { samples: mixDown(channels), sampleRate: buffer.sampleRate };
    } finally {
      void context.close();
    }
  },
};

/** `audio/webm;codecs=opus` → `audio/webm`: storage keeps the container, not the codec. */
export function baseMime(mime: string): string {
  return (mime.split(';')[0] ?? '').trim() || 'audio/webm';
}

/** A file name a recording of «kjære» is stored under: `kjære.webm`. */
export function recordingName(text: string, mime: string): string {
  const ext = baseMime(mime).split('/')[1] ?? 'webm';
  const stem = text.trim().replace(/[\\/:*?"<>|\s]+/g, '-') || 'clip';
  return `${stem}.${ext === 'mpeg' ? 'mp3' : ext}`;
}

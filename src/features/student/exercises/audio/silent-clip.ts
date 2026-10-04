/**
 * A silent clip of a given length, as a `data:` URI — the author's simulated recording
 * (plan 68, decision Q7-A).
 *
 * «Set start here» and the fragment player have to work before a file is attached: the
 * builder is for building the whole exercise first. The kernel's playback engine drives an
 * `<audio>` element, so the simulation is an element too — just one that plays nothing, for
 * as long as the author said the clip is. Every rule (position, ranges, speed) stays the
 * engine's; nothing here knows about them.
 *
 * 8 kHz, 8-bit, mono: the smallest WAV every browser decodes. A `data:` URI rather than a
 * Blob URL because a Blob URL has to be revoked, and the revoke fires between React's
 * StrictMode mount and its re-mount — leaving the element pointing at nothing.
 */
const RATE = 8000;
/** The longest simulated clip. The builder warns at 3 minutes; this is only a memory bound. */
const MAX_SECONDS = 600;

export function silentClip(seconds: number): string | null {
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  const samples = Math.round(Math.min(seconds, MAX_SECONDS) * RATE);

  const bytes = new Uint8Array(44 + samples);
  const view = new DataView(bytes.buffer);
  const tag = (at: number, text: string) => {
    for (let i = 0; i < text.length; i++) bytes[at + i] = text.charCodeAt(i);
  };
  tag(0, 'RIFF');
  view.setUint32(4, 36 + samples, true);
  tag(8, 'WAVE');
  tag(12, 'fmt ');
  view.setUint32(16, 16, true); // PCM header size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, RATE, true);
  view.setUint32(28, RATE, true); // byte rate: 1 byte per sample
  view.setUint16(32, 1, true); // block align
  view.setUint16(34, 8, true); // bits per sample
  tag(36, 'data');
  view.setUint32(40, samples, true);
  bytes.fill(128, 44); // 8-bit PCM silence is the midpoint

  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return `data:audio/wav;base64,${btoa(binary)}`;
}

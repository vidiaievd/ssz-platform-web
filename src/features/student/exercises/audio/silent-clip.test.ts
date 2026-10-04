import { describe, expect, it } from 'vitest';

import { silentClip } from './silent-clip';

function bytesOf(uri: string): Uint8Array {
  const base64 = uri.slice('data:audio/wav;base64,'.length);
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
}

describe('silentClip', () => {
  it('is a WAV exactly as long as asked, and silent', () => {
    const uri = silentClip(3);
    expect(uri).toMatch(/^data:audio\/wav;base64,/);
    const bytes = bytesOf(uri!);
    const view = new DataView(bytes.buffer);
    const tag = (at: number) => String.fromCharCode(...bytes.subarray(at, at + 4));
    expect([tag(0), tag(8), tag(12), tag(36)]).toEqual(['RIFF', 'WAVE', 'fmt ', 'data']);
    const rate = view.getUint32(24, true);
    expect(view.getUint32(40, true) / rate).toBe(3);
    expect(bytes.length).toBe(44 + view.getUint32(40, true));
    expect(new Set(bytes.subarray(44))).toEqual(new Set([128]));
  });

  it('is nothing for a length that is not a length', () => {
    expect(silentClip(0)).toBeNull();
    expect(silentClip(-4)).toBeNull();
    expect(silentClip(Number.NaN)).toBeNull();
  });

  it('is bounded, so a mistyped length cannot fill the tab', () => {
    const bytes = bytesOf(silentClip(100_000)!);
    expect(new DataView(bytes.buffer).getUint32(40, true) / 8000).toBe(600);
  });
});

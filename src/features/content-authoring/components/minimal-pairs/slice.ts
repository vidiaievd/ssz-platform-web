// «Slice one file» — plan 72 Q3-A: a studio session cut into one clip per word, in the browser.
//
// DECISIONS §1: «Drop the whole session, the builder marks regions by silence, and on save it
// cuts one asset per word.» Nothing here touches the network or the page: the file is decoded
// into samples (by the port's `decode`), the words are found as stretches louder than the
// recording's own floor, the author moves the edges, and each region is written out as a WAV of
// its own and uploaded like any other clip. The model keeps no timecodes — after the cut every
// word owns its asset, exactly as if it had been uploaded alone.
//
// Pure functions over a mono `Float32Array`, so the detection is tested without `AudioContext`.

/** A mono recording, as decoded. */
export interface DecodedAudio {
  samples: Float32Array;
  sampleRate: number;
}

/** One word's stretch of the file, in milliseconds. */
export interface Region {
  startMs: number;
  endMs: number;
}

export interface DetectOptions {
  /** RMS frame length. */
  frameMs: number;
  /** A pause shorter than this is inside a word (a stop consonant), not between two. */
  minGapMs: number;
  /** A sound shorter than this is a click or a breath, not a word. */
  minWordMs: number;
  /** Kept around each word so its onset and release are not clipped. */
  padMs: number;
}

export const DETECT_DEFAULTS: DetectOptions = {
  frameMs: 10,
  minGapMs: 220,
  minWordMs: 90,
  padMs: 60,
};

/** The narrowest region the author can drag a word down to. */
export const MIN_REGION_MS = 80;

export function durationMs(audio: DecodedAudio): number {
  return audio.sampleRate > 0 ? (audio.samples.length / audio.sampleRate) * 1000 : 0;
}

/** Loudness per frame — the root mean square of the samples in it. */
export function rmsFrames(audio: DecodedAudio, frameMs: number): Float32Array {
  const size = Math.max(1, Math.round((audio.sampleRate * frameMs) / 1000));
  const count = Math.ceil(audio.samples.length / size);
  const out = new Float32Array(count);
  for (let f = 0; f < count; f++) {
    let sum = 0;
    const from = f * size;
    const to = Math.min(audio.samples.length, from + size);
    for (let i = from; i < to; i++) {
      const s = audio.samples[i] ?? 0;
      sum += s * s;
    }
    out[f] = Math.sqrt(sum / Math.max(1, to - from));
  }
  return out;
}

function percentile(values: Float32Array, p: number): number {
  if (values.length === 0) return 0;
  const sorted = Array.from(values).sort((a, b) => a - b);
  const at = Math.min(sorted.length - 1, Math.max(0, Math.floor(p * (sorted.length - 1))));
  return sorted[at] ?? 0;
}

/**
 * Where the words are: frames above a threshold set between the recording's floor and its loud
 * end, joined across short pauses, short blips dropped, a little room kept on both sides.
 *
 * The threshold is relative — a session recorded quietly and one recorded hot are cut the same
 * way — and taken from percentiles, not from the extremes, so one click does not move it.
 */
export function detectRegions(audio: DecodedAudio, options: Partial<DetectOptions> = {}): Region[] {
  const o = { ...DETECT_DEFAULTS, ...options };
  const frames = rmsFrames(audio, o.frameMs);
  if (frames.length === 0) return [];

  const floor = percentile(frames, 0.1);
  const loud = percentile(frames, 0.98);
  if (loud <= 0 || loud - floor < 0.002) return [];
  const threshold = floor + (loud - floor) * 0.1;

  // Voiced runs, as frame indices [from, to).
  const runs: [number, number][] = [];
  let start = -1;
  for (let f = 0; f <= frames.length; f++) {
    const on = f < frames.length && (frames[f] ?? 0) > threshold;
    if (on && start < 0) start = f;
    if (!on && start >= 0) {
      runs.push([start, f]);
      start = -1;
    }
  }

  // A pause inside a word («kjekk» has a stop in it) is not a gap between two words.
  const gapFrames = Math.round(o.minGapMs / o.frameMs);
  const joined: [number, number][] = [];
  for (const run of runs) {
    const last = joined[joined.length - 1];
    if (last !== undefined && run[0] - last[1] < gapFrames) last[1] = run[1];
    else joined.push([run[0], run[1]]);
  }

  const total = durationMs(audio);
  const words = joined
    .map(([from, to]) => ({ startMs: from * o.frameMs, endMs: Math.min(total, to * o.frameMs) }))
    .filter((r) => r.endMs - r.startMs >= o.minWordMs);

  // Padding, never past the middle of the pause to the neighbour or the ends of the file.
  return words.map((r, i) => {
    const prev = words[i - 1];
    const next = words[i + 1];
    const lo = prev === undefined ? 0 : (prev.endMs + r.startMs) / 2;
    const hi = next === undefined ? total : (r.endMs + next.startMs) / 2;
    return {
      startMs: Math.round(Math.max(lo, r.startMs - o.padMs)),
      endMs: Math.round(Math.min(hi, r.endMs + o.padMs)),
    };
  });
}

/**
 * The detected regions brought down to the number of words that need audio.
 *
 * More regions than words: a region much shorter than the others is noise (a cough, a page
 * turned) and goes first; when none stands out, the two regions closest together are one word
 * the silence split. Fewer regions than words are left as they are — the last words stay
 * without audio, and the button says how many clips it will cut.
 */
export function fitRegions(regions: readonly Region[], words: number): Region[] {
  const out = regions.map((r) => ({ ...r }));
  while (out.length > Math.max(0, words)) {
    const lengths = out.map((r) => r.endMs - r.startMs);
    const median = [...lengths].sort((a, b) => a - b)[Math.floor(lengths.length / 2)] ?? 0;
    const shortest = lengths.indexOf(Math.min(...lengths));
    if ((lengths[shortest] ?? 0) < median * 0.4 || out.length === 1) {
      out.splice(shortest, 1);
      continue;
    }
    let at = 0;
    let gap = Infinity;
    for (let i = 0; i < out.length - 1; i++) {
      const g = out[i + 1]!.startMs - out[i]!.endMs;
      if (g < gap) {
        gap = g;
        at = i;
      }
    }
    out.splice(at, 2, { startMs: out[at]!.startMs, endMs: out[at + 1]!.endMs });
  }
  return out;
}

/**
 * Move one edge of one region, kept inside its neighbours and at least `MIN_REGION_MS` wide.
 * Regions never overlap: a word's clip may not carry the start of the next.
 */
export function moveEdge(
  regions: readonly Region[],
  index: number,
  edge: 'start' | 'end',
  ms: number,
  totalMs: number,
): Region[] {
  const r = regions[index];
  if (r === undefined) return [...regions];
  const prevEnd = regions[index - 1]?.endMs ?? 0;
  const nextStart = regions[index + 1]?.startMs ?? totalMs;
  const next =
    edge === 'start'
      ? { ...r, startMs: Math.round(Math.min(Math.max(ms, prevEnd), r.endMs - MIN_REGION_MS)) }
      : { ...r, endMs: Math.round(Math.max(Math.min(ms, nextStart), r.startMs + MIN_REGION_MS)) };
  return regions.map((x, i) => (i === index ? next : x));
}

/** `count` bars for the waveform: the loudest sample in each slice, scaled to the loudest bar. */
export function peaksOf(audio: DecodedAudio, count: number): number[] {
  if (count <= 0) return [];
  const n = audio.samples.length;
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    const from = Math.floor((i * n) / count);
    const to = Math.max(from + 1, Math.floor(((i + 1) * n) / count));
    let peak = 0;
    for (let j = from; j < to && j < n; j++) peak = Math.max(peak, Math.abs(audio.samples[j] ?? 0));
    out.push(peak);
  }
  const top = Math.max(...out, 0);
  return top > 0 ? out.map((p) => p / top) : out;
}

/**
 * One region as a 16-bit PCM mono WAV. Tens of kilobytes a word; media-service converts it to
 * mp3 and opus like any other upload (Q3-A).
 */
export function encodeWav(audio: DecodedAudio, region: Region): Blob {
  const from = Math.max(0, Math.floor((region.startMs / 1000) * audio.sampleRate));
  const to = Math.min(audio.samples.length, Math.ceil((region.endMs / 1000) * audio.sampleRate));
  const frames = Math.max(0, to - from);
  const buffer = new ArrayBuffer(44 + frames * 2);
  const view = new DataView(buffer);
  const text = (at: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(at + i, s.charCodeAt(i));
  };
  text(0, 'RIFF');
  view.setUint32(4, 36 + frames * 2, true);
  text(8, 'WAVE');
  text(12, 'fmt ');
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, audio.sampleRate, true);
  view.setUint32(28, audio.sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  text(36, 'data');
  view.setUint32(40, frames * 2, true);
  for (let i = 0; i < frames; i++) {
    const s = Math.max(-1, Math.min(1, audio.samples[from + i] ?? 0));
    view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([buffer], { type: 'audio/wav' });
}

/** «0:41» — the session's length in the panel's summary line. */
export function formatClock(ms: number): string {
  const seconds = Math.round(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

/** Every channel averaged into one — the cut is of words, not of a stereo image. */
export function mixDown(channels: readonly Float32Array[]): Float32Array {
  const first = channels[0];
  if (first === undefined) return new Float32Array(0);
  if (channels.length === 1) return first;
  const out = new Float32Array(first.length);
  for (const ch of channels)
    for (let i = 0; i < out.length; i++) out[i]! += (ch[i] ?? 0) / channels.length;
  return out;
}

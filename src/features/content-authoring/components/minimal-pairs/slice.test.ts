import { describe, expect, it } from 'vitest';

import {
  detectRegions,
  durationMs,
  encodeWav,
  fitRegions,
  formatClock,
  mixDown,
  MIN_REGION_MS,
  moveEdge,
  peaksOf,
  type DecodedAudio,
  type Region,
} from './slice';

const RATE = 8000;

/**
 * A synthetic session: a quiet floor of noise, with a 220 Hz tone at `amp` over each stretch.
 * Deterministic — the noise is a fixed sequence, not `Math.random`.
 */
function session(totalMs: number, words: [number, number, number?][]): DecodedAudio {
  const samples = new Float32Array(Math.round((totalMs / 1000) * RATE));
  let seed = 7;
  for (let i = 0; i < samples.length; i++) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    samples[i] = ((seed / 0x7fffffff) * 2 - 1) * 0.004;
  }
  for (const [from, to, amp = 0.5] of words) {
    for (let i = Math.round((from / 1000) * RATE); i < Math.round((to / 1000) * RATE); i++) {
      samples[i] = (samples[i] ?? 0) + amp * Math.sin((2 * Math.PI * 220 * i) / RATE);
    }
  }
  return { samples, sampleRate: RATE };
}

const near = (actual: number, expected: number, tolerance = 40) =>
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tolerance);

describe('detectRegions — words found by silence (Q3-A)', () => {
  it('finds one region per word, padded and inside the file', () => {
    const audio = session(3000, [
      [300, 900],
      [1300, 1900],
      [2300, 2800],
    ]);
    const regions = detectRegions(audio);
    expect(regions).toHaveLength(3);
    near(regions[0]!.startMs, 240);
    near(regions[0]!.endMs, 960);
    near(regions[2]!.endMs, 2860);
    for (const r of regions) {
      expect(r.startMs).toBeGreaterThanOrEqual(0);
      expect(r.endMs).toBeLessThanOrEqual(durationMs(audio));
    }
  });

  it('keeps a word whole across the short stop inside it («kjekk»)', () => {
    const audio = session(2000, [
      [300, 600],
      [700, 1000],
    ]);
    expect(detectRegions(audio)).toHaveLength(1);
  });

  it('drops a click shorter than a word', () => {
    const audio = session(2000, [
      [300, 900],
      [1400, 1440],
    ]);
    expect(detectRegions(audio)).toHaveLength(1);
  });

  it('cuts a quietly recorded session the same way as a loud one', () => {
    const loud = detectRegions(
      session(2500, [
        [300, 900],
        [1400, 2000],
      ]),
    );
    const quiet = detectRegions(
      session(2500, [
        [300, 900, 0.05],
        [1400, 2000, 0.05],
      ]),
    );
    expect(quiet).toHaveLength(2);
    quiet.forEach((r, i) => {
      near(r.startMs, loud[i]!.startMs);
      near(r.endMs, loud[i]!.endMs);
    });
  });

  it('never pads a region past the middle of the pause to its neighbour', () => {
    const regions = detectRegions(
      session(2000, [
        [200, 700],
        [950, 1500],
      ]),
      { padMs: 400 },
    );
    expect(regions[0]!.endMs).toBeLessThanOrEqual(regions[1]!.startMs);
  });

  it('finds nothing in silence', () => {
    expect(detectRegions(session(1500, []))).toEqual([]);
    expect(detectRegions({ samples: new Float32Array(0), sampleRate: RATE })).toEqual([]);
  });
});

describe('fitRegions — as many regions as words', () => {
  const r = (startMs: number, endMs: number): Region => ({ startMs, endMs });

  it('drops a stray sound much shorter than the words', () => {
    expect(fitRegions([r(0, 600), r(800, 900), r(1200, 1800)], 2)).toEqual([
      r(0, 600),
      r(1200, 1800),
    ]);
  });

  it('joins the two regions closest together when none is a stray', () => {
    expect(fitRegions([r(0, 500), r(560, 1000), r(1600, 2100)], 2)).toEqual([
      r(0, 1000),
      r(1600, 2100),
    ]);
  });

  it('leaves fewer regions than words as they are', () => {
    const two = [r(0, 500), r(900, 1400)];
    expect(fitRegions(two, 4)).toEqual(two);
  });

  it('gives nothing when no word needs audio', () => {
    expect(fitRegions([r(0, 500)], 0)).toEqual([]);
  });
});

describe('moveEdge — the author drags an edge', () => {
  const regions: Region[] = [
    { startMs: 100, endMs: 600 },
    { startMs: 900, endMs: 1400 },
  ];

  it('moves the edge it was asked to', () => {
    expect(moveEdge(regions, 0, 'end', 700, 2000)[0]).toEqual({ startMs: 100, endMs: 700 });
    expect(moveEdge(regions, 1, 'start', 850, 2000)[1]).toEqual({ startMs: 850, endMs: 1400 });
  });

  it('stops at the neighbour and at the ends of the file', () => {
    expect(moveEdge(regions, 0, 'end', 1200, 2000)[0]!.endMs).toBe(900);
    expect(moveEdge(regions, 1, 'start', 300, 2000)[1]!.startMs).toBe(600);
    expect(moveEdge(regions, 0, 'start', -50, 2000)[0]!.startMs).toBe(0);
    expect(moveEdge(regions, 1, 'end', 5000, 2000)[1]!.endMs).toBe(2000);
  });

  it('keeps a region at least the minimum wide', () => {
    expect(moveEdge(regions, 0, 'start', 590, 2000)[0]!.startMs).toBe(600 - MIN_REGION_MS);
    expect(moveEdge(regions, 0, 'end', 110, 2000)[0]!.endMs).toBe(100 + MIN_REGION_MS);
  });
});

describe('the cut', () => {
  it('writes a region as 16-bit mono PCM with a correct RIFF header', async () => {
    const audio = session(1000, [[0, 1000]]);
    const blob = encodeWav(audio, { startMs: 250, endMs: 750 });
    expect(blob.type).toBe('audio/wav');
    const bytes = new DataView(await blob.arrayBuffer());
    const tag = (at: number) =>
      String.fromCharCode(...[0, 1, 2, 3].map((i) => bytes.getUint8(at + i)));
    expect(tag(0)).toBe('RIFF');
    expect(tag(8)).toBe('WAVE');
    expect(tag(36)).toBe('data');
    expect(bytes.getUint16(22, true)).toBe(1);
    expect(bytes.getUint32(24, true)).toBe(RATE);
    expect(bytes.getUint32(40, true)).toBe(RATE * 0.5 * 2);
    expect(blob.size).toBe(44 + RATE * 0.5 * 2);
  });

  it('draws peaks scaled to the loudest bar', () => {
    const peaks = peaksOf(session(1000, [[500, 1000]]), 10);
    expect(peaks).toHaveLength(10);
    expect(Math.max(...peaks)).toBe(1);
    expect(peaks[0]!).toBeLessThan(0.05);
  });

  it('mixes channels down to one', () => {
    expect(Array.from(mixDown([new Float32Array([1, 0]), new Float32Array([0, 1])]))).toEqual([
      0.5, 0.5,
    ]);
  });

  it('says the session length as m:ss', () => {
    expect(formatClock(41_000)).toBe('0:41');
    expect(formatClock(125_400)).toBe('2:05');
  });
});

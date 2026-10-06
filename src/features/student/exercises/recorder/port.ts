// The microphone, as the `read_aloud` runner sees it — plan 70, phase 6.1.
//
// The recorder's rules live in the kernel (`read-aloud/recorder.ts`): when a take starts, when it
// stops, what an interruption costs. None of that is here. This is the other half — the hardware
// and the bytes — behind a port, for the same reason the audio layer keeps its engine apart from
// its element (plan 56): jsdom has no `MediaRecorder`, no `getUserMedia` and no `AudioContext`,
// and a runner that cannot be tested without them is a runner nobody tests. The browser
// implementation is `browser-recorder.ts`; tests use `mock-recorder.ts`.

/** Why the microphone could not be opened. Each is a state of its own (README, Q7-A). */
export type MicFailure = 'denied' | 'noDevice';

export type OpenResult = 'ok' | MicFailure;

/**
 * Why the hardware stopped being usable underneath the runner.
 *
 *   ended          the track ended — the device was unplugged, the OS took the microphone, a call
 *   deviceChanged  the input the stream was opened on is gone from the device list
 *   hidden         the page went to the background
 *
 * The first two also close the stream: the next take opens a new one, on whatever input is the
 * default by then.
 */
export type InterruptReason = 'ended' | 'deviceChanged' | 'hidden';

/** One finished take, as the hardware handed it over. */
export interface Capture {
  blob: Blob;
  /** What the recorder actually produced — `audio/webm;codecs=opus`, `audio/mp4`, … */
  mimeType: string;
  /** Measured by the adapter's own clock, not by the runner's whole-second ticks. */
  seconds: number;
  /**
   * The loudness through the take, 0..1, sampled every `ENVELOPE_MS`. The take's waveform until
   * the server's peaks arrive (plan 70 §4.2 item 11) — and the only one the builder preview has.
   */
  envelope: number[];
}

/** How often the envelope is sampled while a take is recording. */
export const ENVELOPE_MS = 100;

/** Bars in the level meter (`ra-meter`). */
export const METER_BANDS = 18;

export interface RecorderPort {
  /**
   * Ask for the microphone. Idempotent while a stream is open; a second call during the first
   * returns the same answer.
   */
  open(): Promise<OpenResult>;
  /** Whether a stream is open right now. */
  isOpen(): boolean;
  /** `METER_BANDS` levels, 0..1, as the microphone hears them now. Flat when nothing is open. */
  levels(): number[];
  /** Start a take on the open stream. Does nothing when no stream is open or a take is running. */
  start(): void;
  /** Finish the take. `null` when no take was running or it was cancelled meanwhile. */
  stop(): Promise<Capture | null>;
  /** Throw the running take away — an interruption is not the student's attempt. */
  cancel(): void;
  /** Release the microphone and everything built on it. */
  close(): void;
  /** Subscribe to interruptions; returns the unsubscribe. */
  onInterrupt(listener: (reason: InterruptReason) => void): () => void;
}

/** The meter at rest. */
export function flatLevels(): number[] {
  return new Array<number>(METER_BANDS).fill(0);
}

/**
 * `count` values out of an envelope of any length: the loudest sample in each slice, so a short
 * loud word is not averaged away. Fewer samples than bars are stretched, never invented.
 */
export function bucketPeaks(envelope: readonly number[], count: number): number[] {
  if (count <= 0) return [];
  if (envelope.length === 0) return new Array<number>(count).fill(0);
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    const from = Math.floor((i * envelope.length) / count);
    const to = Math.max(from + 1, Math.floor(((i + 1) * envelope.length) / count));
    let peak = 0;
    for (let j = from; j < to && j < envelope.length; j++) peak = Math.max(peak, envelope[j] ?? 0);
    out.push(Math.min(1, Math.max(0, peak)));
  }
  return out;
}

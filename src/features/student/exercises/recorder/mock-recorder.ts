import {
  flatLevels,
  METER_BANDS,
  type Capture,
  type InterruptReason,
  type OpenResult,
  type RecorderPort,
} from './port';

/** A port with the hardware replaced by switches — for tests, which have none (jsdom). */
export interface MockRecorder extends RecorderPort {
  /** What the next `open()` answers. */
  openWith(result: OpenResult): void;
  /** What the meter hears from now on: one value for every band. */
  hear(level: number): void;
  /** How long the next take turns out to be, in seconds. */
  nextTakeSeconds(seconds: number | null): void;
  /** Fire an interruption, as the browser would. */
  interrupt(reason: InterruptReason): void;
  readonly calls: { open: number; start: number; stop: number; cancel: number; close: number };
}

export function createMockRecorder(): MockRecorder {
  let openResult: OpenResult = 'ok';
  let open = false;
  let recording = false;
  let level = 0;
  let takeSeconds: number | null = null;
  const listeners = new Set<(reason: InterruptReason) => void>();
  const calls = { open: 0, start: 0, stop: 0, cancel: 0, close: 0 };

  return {
    calls,
    openWith(result) {
      openResult = result;
    },
    hear(value) {
      level = value;
    },
    nextTakeSeconds(seconds) {
      takeSeconds = seconds;
    },
    interrupt(reason) {
      if (reason !== 'hidden') {
        open = false;
        recording = false;
      }
      listeners.forEach((l) => l(reason));
    },
    open() {
      calls.open += 1;
      open = openResult === 'ok';
      return Promise.resolve(openResult);
    },
    isOpen: () => open,
    levels: () => (open ? new Array<number>(METER_BANDS).fill(level) : flatLevels()),
    start() {
      if (!open) return;
      calls.start += 1;
      recording = true;
    },
    stop() {
      calls.stop += 1;
      if (!recording) return Promise.resolve(null);
      recording = false;
      const capture: Capture = {
        blob: new Blob(['take'], { type: 'audio/webm;codecs=opus' }),
        mimeType: 'audio/webm;codecs=opus',
        seconds: takeSeconds ?? 0,
        envelope: [0.2, 0.6, 0.4],
      };
      return Promise.resolve(takeSeconds === null ? { ...capture, seconds: Number.NaN } : capture);
    },
    cancel() {
      calls.cancel += 1;
      recording = false;
    },
    close() {
      calls.close += 1;
      open = false;
      recording = false;
    },
    onInterrupt(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

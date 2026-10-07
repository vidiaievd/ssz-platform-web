// The microphone for `read_aloud` — plan 70, phase 6.1. The rules are the kernel's
// (`read-aloud/recorder.ts`); this is the hardware behind a port, and the hook that joins them.

export type { Capture, InterruptReason, MicFailure, OpenResult, RecorderPort } from './port';
export { bucketPeaks, ENVELOPE_MS, flatLevels, METER_BANDS } from './port';
export { bandsOf, createBrowserRecorder, failureOf, pickMimeType } from './browser-recorder';
export { createMockRecorder } from './mock-recorder';
export type { MockRecorder } from './mock-recorder';
export { LEVEL_MS, useRecorder } from './use-recorder';
export type { CapturedTake, RecorderHandle, UseRecorderOptions } from './use-recorder';

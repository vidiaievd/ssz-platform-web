import { LIMITS } from '@/lib/shared-kernel/read-aloud';

import {
  ENVELOPE_MS,
  flatLevels,
  METER_BANDS,
  type Capture,
  type InterruptReason,
  type OpenResult,
  type RecorderPort,
} from './port';

/**
 * The analyser's window, in dBFS. The default floor (-100) puts room noise a third of the way
 * up the meter and passes the microphone check in a silent room; -70 leaves a quiet room near
 * zero and ordinary speech well above `MIC_LEVEL_THRESHOLD`.
 */
const MIN_DB = -70;
const MAX_DB = -25;
/** Voice lives in the lower part of the spectrum; the bands spread over this share of the bins. */
const VOICE_SHARE = 0.5;

type AudioContextCtor = typeof AudioContext;

/**
 * The first MIME type this browser records, from the kernel's list: opus in WebM, then MP4 for
 * Safari (README «Recording in the client», RA-U1). Empty when it records neither — the
 * recorder then picks its own default, which media-service still has to accept.
 */
export function pickMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return '';
  const supported = (type: string) =>
    typeof MediaRecorder.isTypeSupported === 'function' && MediaRecorder.isTypeSupported(type);
  return [LIMITS.mime, LIMITS.fallbackMime].find(supported) ?? '';
}

/**
 * How `getUserMedia` refused. A refusal by the person or the page's permissions is `denied`;
 * everything else — no input at all, an input another app holds, constraints nothing meets —
 * is a missing device as far as the student can do anything about it.
 */
export function failureOf(error: unknown): 'denied' | 'noDevice' {
  const name = error instanceof Error || error instanceof DOMException ? error.name : '';
  return name === 'NotAllowedError' || name === 'SecurityError' || name === 'PermissionDeniedError'
    ? 'denied'
    : 'noDevice';
}

/** `METER_BANDS` levels out of an analyser's frequency bins. */
export function bandsOf(bins: Uint8Array): number[] {
  const usable = Math.max(METER_BANDS, Math.floor(bins.length * VOICE_SHARE));
  const per = usable / METER_BANDS;
  const out: number[] = [];
  for (let b = 0; b < METER_BANDS; b++) {
    const from = Math.floor(b * per);
    const to = Math.max(from + 1, Math.floor((b + 1) * per));
    let sum = 0;
    for (let i = from; i < to; i++) sum += bins[i] ?? 0;
    out.push(Math.min(1, sum / (to - from) / 255));
  }
  return out;
}

/**
 * The port over `getUserMedia` + `MediaRecorder` + an `AnalyserNode` (plan 70 §6.1).
 *
 * Inert until `open()`: constructing it touches nothing, so a component can hold one from its
 * first render, on the server too. One stream serves the level check and every take; a take is
 * a `MediaRecorder` on that stream, started and stopped per take.
 *
 * What it reports as an interruption is what README calls real states: the track ending under
 * it, the input it opened disappearing from the device list (a headset unplugged mid-take — not
 * any device change: plugging headphones in must not cost a take), and the page going to the
 * background. Whether that matters is the kernel's call — it ignores all three outside the
 * phases that count.
 */
export function createBrowserRecorder(): RecorderPort {
  let stream: MediaStream | null = null;
  let context: AudioContext | null = null;
  let analyser: AnalyserNode | null = null;
  let bins: Uint8Array<ArrayBuffer> | null = null;
  let opening: Promise<OpenResult> | null = null;

  let recorder: MediaRecorder | null = null;
  let chunks: Blob[] = [];
  let startedAt = 0;
  let envelope: number[] = [];
  let envelopeTimer: ReturnType<typeof setInterval> | null = null;
  let cancelled = false;
  let finishing: Promise<Capture | null> | null = null;

  const listeners = new Set<(reason: InterruptReason) => void>();
  const emit = (reason: InterruptReason) => listeners.forEach((l) => l(reason));

  function levels(): number[] {
    if (analyser === null || bins === null) return flatLevels();
    analyser.getByteFrequencyData(bins);
    return bandsOf(bins);
  }

  function stopEnvelope() {
    if (envelopeTimer !== null) clearInterval(envelopeTimer);
    envelopeTimer = null;
  }

  function onVisibility() {
    if (document.hidden) emit('hidden');
  }

  async function onDeviceChange() {
    const track = stream?.getAudioTracks()[0];
    if (track === undefined) return;
    const id = track.getSettings().deviceId;
    // Without an id to look for, there is nothing to compare — a change is not evidence of loss.
    if (id === undefined || id === '') return;
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      if (devices.some((d) => d.kind === 'audioinput' && d.deviceId === id)) return;
    } catch {
      return;
    }
    release();
    emit('deviceChanged');
  }

  function release() {
    stopEnvelope();
    if (recorder !== null && recorder.state !== 'inactive') {
      cancelled = true;
      recorder.stop();
    }
    recorder = null;
    stream?.getTracks().forEach((t) => {
      t.onended = null;
      t.stop();
    });
    stream = null;
    analyser = null;
    bins = null;
    void context?.close().catch(() => undefined);
    context = null;
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', onVisibility);
    }
    if (typeof navigator !== 'undefined' && navigator.mediaDevices !== undefined) {
      navigator.mediaDevices.removeEventListener?.('devicechange', onDeviceChange);
    }
  }

  async function doOpen(): Promise<OpenResult> {
    if (
      typeof navigator === 'undefined' ||
      navigator.mediaDevices?.getUserMedia === undefined ||
      typeof MediaRecorder === 'undefined'
    ) {
      // No recorder at all — an old Safari, an insecure origin — is no microphone to the student.
      return 'noDevice';
    }

    let opened: MediaStream;
    try {
      opened = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 },
      });
    } catch (e) {
      return failureOf(e);
    }
    stream = opened;

    const Ctor: AudioContextCtor | undefined =
      typeof window === 'undefined'
        ? undefined
        : (window.AudioContext ??
          (window as unknown as { webkitAudioContext?: AudioContextCtor }).webkitAudioContext);
    if (Ctor !== undefined) {
      // The meter is a courtesy; a browser that will not analyse can still record.
      try {
        context = new Ctor();
        analyser = context.createAnalyser();
        analyser.fftSize = 256;
        analyser.minDecibels = MIN_DB;
        analyser.maxDecibels = MAX_DB;
        analyser.smoothingTimeConstant = 0.6;
        context.createMediaStreamSource(opened).connect(analyser);
        bins = new Uint8Array(analyser.frequencyBinCount);
        void context.resume().catch(() => undefined);
      } catch {
        analyser = null;
        bins = null;
      }
    }

    for (const track of opened.getAudioTracks()) {
      track.onended = () => {
        release();
        emit('ended');
      };
    }
    document.addEventListener('visibilitychange', onVisibility);
    navigator.mediaDevices.addEventListener?.('devicechange', onDeviceChange);
    return 'ok';
  }

  return {
    open() {
      if (stream !== null) return Promise.resolve('ok');
      if (opening === null) {
        opening = doOpen().finally(() => {
          opening = null;
        });
      }
      return opening;
    },

    isOpen: () => stream !== null,

    levels,

    start() {
      if (stream === null || (recorder !== null && recorder.state !== 'inactive')) return;
      const mimeType = pickMimeType();
      try {
        recorder = new MediaRecorder(stream, {
          ...(mimeType === '' ? {} : { mimeType }),
          audioBitsPerSecond: LIMITS.bitrate,
        });
      } catch {
        recorder = new MediaRecorder(stream);
      }
      chunks = [];
      envelope = [];
      cancelled = false;
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      // Timesliced, so a take the browser kills halfway still has its first seconds in hand.
      recorder.start(1000);
      startedAt = performance.now();
      envelopeTimer = setInterval(() => {
        envelope.push(Math.max(...levels()));
      }, ENVELOPE_MS);
    },

    stop() {
      if (finishing !== null) return finishing;
      const active = recorder;
      if (active === null || active.state === 'inactive') return Promise.resolve(null);
      finishing = new Promise<Capture | null>((resolve) => {
        active.onstop = () => {
          stopEnvelope();
          const seconds = (performance.now() - startedAt) / 1000;
          const mimeType = active.mimeType || pickMimeType() || LIMITS.mime;
          const blob = new Blob(chunks, { type: mimeType });
          recorder = null;
          finishing = null;
          resolve(cancelled || blob.size === 0 ? null : { blob, mimeType, seconds, envelope });
        };
        active.stop();
      });
      return finishing;
    },

    cancel() {
      const active = recorder;
      if (active === null || active.state === 'inactive') return;
      cancelled = true;
      stopEnvelope();
      // A `stop()` in flight resolves `null` through its own handler; otherwise nobody waits.
      if (finishing === null) recorder = null;
      active.stop();
    },

    close: release,

    onInterrupt(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

import type { Capture, RecorderPort } from '@/features/student/exercises/recorder';
import { parsePrecheckResult, type PrecheckResult } from '@/features/student/precheck';

/**
 * What the drill needs to let a learner say a sentence and hear back (plan 86, step 6g). Given
 * by whoever owns the attempt; absent where there is nothing to check against (a lesson, a
 * preview, an attempt no longer in progress), and then the drill only shows.
 */
export interface SentenceRecording {
  /** A microphone of the drill's own: it opens for one take and is closed after it. */
  createPort: () => RecorderPort;
  /** Upload the take and ask for the sentence to be heard. Never rejects. */
  check: (input: { itemId: string; sentence: string; capture: Capture }) => Promise<SentenceAnswer>;
}

/** Why a sentence got no remarks, as the drill says it. */
export type SentenceLine = 'failed' | 'notReady' | 'inaudible' | 'tryLimit' | 'closed' | 'unsupported';

/** The drill's reading of the engine's answer to one sentence. */
export type SentenceAnswer =
  | { kind: 'heard'; result: PrecheckResult }
  | { kind: 'line'; line: SentenceLine };

/**
 * The engine's answer for a sentence (`status` ok / refused / failed) as the drill reads it.
 * The words and remarks go through the rehearsal's parser — the same shape, the same silence
 * for what cannot be read in full.
 */
export function answerOf(raw: unknown): SentenceAnswer {
  const body = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};
  if (body.status === 'refused') {
    switch (body.reason) {
      case 'attempt_limit':
        return { kind: 'line', line: 'tryLimit' };
      case 'language_not_supported':
        return { kind: 'line', line: 'unsupported' };
      case 'pool_empty': {
        const result = parsePrecheckResult({ ai: { status: 'refused', reason: 'pool_empty' } });
        return result === null ? { kind: 'line', line: 'failed' } : { kind: 'heard', result };
      }
      default:
        return { kind: 'line', line: 'failed' };
    }
  }
  if (body.status === 'failed') {
    const code = body.errorCode;
    if (code === 'recording_inaudible') return { kind: 'line', line: 'inaudible' };
    if (code === 'recording_not_ready' || code === 'recording_missing') {
      return { kind: 'line', line: 'notReady' };
    }
    return { kind: 'line', line: 'failed' };
  }
  const result = parsePrecheckResult({ ai: { status: body.status }, feedback: body.feedback });
  return result === null || result.feedback === null
    ? { kind: 'line', line: 'failed' }
    : { kind: 'heard', result };
}

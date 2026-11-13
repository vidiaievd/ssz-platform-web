'use client';

import { useCallback, useMemo } from 'react';
import { useLocale } from 'next-intl';

import type { Capture } from '@/features/student/exercises/recorder';
import { uploadRecording } from '@/features/media/lib/upload';

import { answerOf, type SentenceAnswer } from './sentence-recording';

function extensionOf(mimeType: string): string {
  if (mimeType.includes('mp4')) return 'm4a';
  if (mimeType.includes('ogg')) return 'ogg';
  return 'webm';
}

/**
 * The drill's way to the engine (plan 86, step 6g): the take goes up as a recording of this
 * attempt, the sentence is heard, and the take is deleted — it is a try, not a submission, and
 * the teacher will not hear it. A failed delete costs nothing but storage.
 *
 * 403 / 409 are final for the attempt (the school switched checks off, or the work is in): the
 * drill says so and stops offering. Anything else that goes wrong is «try again».
 */
export function useSentenceCheck(exerciseId: string, attemptId: string) {
  const locale = useLocale();

  const check = useCallback(
    async (input: { itemId: string; sentence: string; capture: Capture }): Promise<SentenceAnswer> => {
      let assetId: string;
      try {
        ({ assetId } = await uploadRecording({
          blob: input.capture.blob,
          mimeType: input.capture.mimeType,
          attemptId,
          filename: `${input.itemId}-sentence.${extensionOf(input.capture.mimeType)}`,
        }));
      } catch {
        return { kind: 'line', line: 'failed' };
      }
      try {
        const res = await fetch(`/api/exercises/${exerciseId}/attempts/${attemptId}/sentence-checks`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            itemId: input.itemId,
            sentence: input.sentence,
            recordingAssetId: assetId,
            explanationLanguage: locale,
          }),
        });
        if (res.status === 403 || res.status === 409) return { kind: 'line', line: 'closed' };
        if (!res.ok) return { kind: 'line', line: 'failed' };
        return answerOf(await res.json().catch(() => null));
      } catch {
        return { kind: 'line', line: 'failed' };
      } finally {
        void fetch(`/api/media/assets/${assetId}`, { method: 'DELETE' }).catch(() => undefined);
      }
    },
    [exerciseId, attemptId, locale],
  );

  return useMemo(() => check, [check]);
}

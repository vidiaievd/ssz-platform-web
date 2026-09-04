'use client';

import { useQuery } from '@tanstack/react-query';

import type { LessonAudioRef } from '@/lib/shared-kernel/audio';
import { findAudioNarration } from '@/lib/content/lesson-media-tokens';
import type { LessonVariant } from '@/features/content/types';

/**
 * The narration an exercise borrows from a lesson — plan 56 §3.8, phase 6.
 *
 * `source: 'lesson'` stores a reference and not a copy, so that replacing the recording in
 * the lesson replaces it in every exercise that borrows it. Turning the reference into an
 * asset id means reading the lesson's body, where the recording lives as an `[audio:id]`
 * token, and that is done **here, in the browser**.
 *
 * Resolving it on the server was the alternative and it does not work: two services
 * project the audio block — content-service in `student-safe-content.ts` and the engine in
 * `start-attempt.handler.ts` — and the engine has no lessons. A resolution that only one
 * of them could perform would leave the practice envelope silently without a clip. Doing
 * it in the reader costs one request before the first play and behaves the same either
 * way, whichever service dealt the exercise.
 *
 * A lesson that has been deleted, a variant that has been replaced, a body whose token has
 * been removed: each comes back as `null`, which the player renders as an exercise whose
 * clip cannot be played — the same state as a broken link, and not a crash.
 */
export function useLessonClip(ref: LessonAudioRef | null): string | undefined {
  const lessonId = ref?.lessonId ?? '';
  const variantId = ref?.variant ?? '';

  const { data } = useQuery<string | null>({
    queryKey: ['exercise-audio', 'lesson-clip', lessonId, variantId],
    queryFn: async () => {
      const res = await fetch(`/api/content/lessons/${lessonId}/variants`);
      if (!res.ok) return null;

      const variants = (await res.json()) as LessonVariant[];
      const variant = variants.find((candidate) => candidate.id === variantId);
      if (variant === undefined) return null;

      return findAudioNarration(variant.bodyMarkdown)?.mediaId ?? null;
    },
    // The body of a published lesson changes rarely, and a learner who replays an exercise
    // three times should ask about it once.
    staleTime: 120_000,
    enabled: lessonId !== '' && variantId !== '',
  });

  return data ?? undefined;
}

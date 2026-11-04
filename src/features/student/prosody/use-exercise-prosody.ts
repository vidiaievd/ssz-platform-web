'use client';

import { useQuery } from '@tanstack/react-query';

import type { ExerciseProsodyResponse } from '@/app/api/content/exercises/[id]/prosody/route';
import type { LessonProsodyResponse } from '@/app/api/content/lessons/[id]/variants/[variantId]/prosody/route';
import type { ProsodyLayer, WordSounds } from '@/lib/shared-kernel/prosody';

/** A prompt's text with the layer drawn for it — the text guards against a layer for other words. */
export interface PromptProsody {
  text: string;
  layer: ProsodyLayer;
  /** The lexicon's letters over sounds of the words (plan 86, step 6d); empty when it has none. */
  sounds: WordSounds[];
}

/**
 * The prosody layers of a `read_aloud` exercise, keyed by prompt id.
 *
 * Fetched only while `enabled` — the learner has left «Meaning» — so a learner who never does
 * never costs the lexicon call. A failure is an empty map: the text is drawn plain (the BFF
 * answers an empty list for every miss, this covers the network).
 */
export function useExerciseProsody(exerciseId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['exercise', exerciseId, 'prosody'] as const,
    queryFn: async (): Promise<Record<string, PromptProsody>> => {
      const res = await fetch(`/api/content/exercises/${exerciseId}/prosody`);
      if (!res.ok) return {};
      const body = (await res.json()) as ExerciseProsodyResponse;
      return Object.fromEntries(
        body.prompts.map((p) => [
          p.promptId,
          { text: p.text, layer: p.layer, sounds: p.sounds ?? [] },
        ]),
      );
    },
    staleTime: 120_000,
    enabled: enabled && exerciseId !== '',
  });
}

/** A paragraph's text with the layer drawn for it, by the paragraph's index in the variant. */
export function useLessonProsody(
  lessonId: string,
  variantId: string | undefined,
  enabled: boolean,
) {
  return useQuery({
    queryKey: ['lesson', lessonId, 'variant', variantId ?? '', 'prosody'] as const,
    queryFn: async (): Promise<Map<number, PromptProsody>> => {
      const res = await fetch(`/api/content/lessons/${lessonId}/variants/${variantId}/prosody`);
      if (!res.ok) return new Map();
      const body = (await res.json()) as LessonProsodyResponse;
      return new Map(
        body.paragraphs.map((p) => [
          p.paragraphIndex,
          { text: p.text, layer: p.layer, sounds: p.sounds ?? [] },
        ]),
      );
    },
    staleTime: 120_000,
    enabled: enabled && lessonId !== '' && variantId !== undefined,
  });
}

'use client';

import { useMemo } from 'react';

import {
  guideShown,
  type GuidePrompt,
  type ReadAloudContent,
} from '@/lib/shared-kernel/read-aloud';

import {
  loadPromptProsodyAction,
  savePromptProsodyAction,
  suggestPromptProsodyAction,
} from '../../actions/prosody';
import {
  useProsodyLayers,
  type ProsodyLayerApi,
  type ProsodyLayers,
} from '../prosody-editor/use-prosody-layers';

export type {
  LayerSaveState,
  ProsodyLayerState as PromptProsodyState,
} from '../prosody-editor/use-prosody-layers';

export interface PromptProsody extends ProsodyLayers {
  /**
   * The kernel's `ctx.guide`: only prompts whose view lies on the text the builder shows now.
   * A prompt the author is still typing is left out until its text is saved and read again —
   * the kernel asks nothing of a missing prompt, rather than judging marks against old text.
   */
  guide: Readonly<Record<string, GuidePrompt>>;
}

export interface UsePromptProsodyOptions {
  exerciseId: string;
  exercise: ReadAloudContent & { updatedAt: string };
}

/**
 * The marks of every `read` prompt of the exercise, for the «Pronunciation» step and the rail
 * (plan 86, step 6h.3) — `useProsodyLayers` over the prompts, by prompt id.
 *
 * Prompts are read while the guide is on and again each time the document's autosave lands
 * (`updatedAt` moves); nothing is read while it is off.
 */
export function usePromptProsody({ exerciseId, exercise }: UsePromptProsodyOptions): PromptProsody {
  const api = useMemo<ProsodyLayerApi>(
    () => ({
      load: (promptId) => loadPromptProsodyAction(exerciseId, promptId),
      save: (promptId, input) => savePromptProsodyAction(exerciseId, promptId, input),
      suggest: (promptId) => suggestPromptProsodyAction(exerciseId, promptId),
    }),
    [exerciseId],
  );
  const layers = useProsodyLayers({
    api,
    passages: exercise.prompts,
    on: guideShown(exercise),
    revision: exercise.updatedAt,
  });
  const { byPassage, layerOf } = layers;

  const guide = useMemo(() => {
    const out: Record<string, GuidePrompt> = {};
    for (const prompt of exercise.prompts) {
      const state = byPassage[prompt.id];
      const layer = layerOf(prompt.id);
      if (state?.status !== 'loaded' || state.view.text !== prompt.text || layer === null) continue;
      out[prompt.id] = { layer, unresolved: state.view.lexicon.unresolved };
    }
    return out;
  }, [byPassage, layerOf, exercise.prompts]);

  return { ...layers, guide };
}

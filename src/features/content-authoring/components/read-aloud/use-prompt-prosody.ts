'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  guideShown,
  type GuidePrompt,
  type ReadAloudContent,
} from '@/lib/shared-kernel/read-aloud';

import { loadPromptProsodyAction, type PromptProsodyAuthoring } from '../../actions/prosody';

export type PromptProsodyState =
  | { status: 'loading' }
  | { status: 'loaded'; view: PromptProsodyAuthoring }
  /** No passage on the server yet — nothing to mark. */
  | { status: 'absent' }
  | { status: 'failed' };

export interface PromptProsody {
  /** By prompt id; a prompt never read is missing. */
  byPrompt: Readonly<Record<string, PromptProsodyState>>;
  /**
   * The kernel's `ctx.guide`: only prompts whose view lies on the text the builder shows now.
   * A prompt the author is still typing is left out until its text is saved and read again —
   * the kernel asks nothing of a missing prompt, rather than judging marks against old text.
   */
  guide: Readonly<Record<string, GuidePrompt>>;
  /** After a save or a suggestion: the view the server answered with. */
  setView: (promptId: string, view: PromptProsodyAuthoring) => void;
  reload: (promptId: string) => void;
}

export interface UsePromptProsodyOptions {
  exerciseId: string;
  exercise: ReadAloudContent & { updatedAt: string };
}

/**
 * The marks of every `read` prompt of the exercise, for the «Pronunciation» step and the rail
 * (plan 86, step 6h.3).
 *
 * The server re-anchors the stored layer to the **saved** draft, so a prompt is read when the
 * guide is on and again each time the document's autosave lands (`updatedAt` moves) with a text
 * that differs from the one last read. Nothing is read while the guide is off.
 */
export function usePromptProsody({ exerciseId, exercise }: UsePromptProsodyOptions): PromptProsody {
  const [byPrompt, setByPrompt] = useState<Record<string, PromptProsodyState>>({});
  /** The text the server last answered for each prompt — what its view is anchored to. */
  const known = useRef<Map<string, string>>(new Map());
  /** The latest read per prompt: the text the builder showed and a ticket that outdates older reads. */
  const pending = useRef<Map<string, { text: string; ticket: number }>>(new Map());
  const tickets = useRef(0);

  const on = guideShown(exercise);
  const promptsRef = useRef(exercise.prompts);
  useEffect(() => {
    promptsRef.current = exercise.prompts;
  });

  const read = useCallback(
    (promptId: string, text: string) => {
      const ticket = ++tickets.current;
      pending.current.set(promptId, { text, ticket });
      setByPrompt((current) => ({ ...current, [promptId]: { status: 'loading' } }));
      const settle = (state: PromptProsodyState, answered: string) => {
        // A later read of the same prompt has taken over.
        if (pending.current.get(promptId)?.ticket !== ticket) return;
        pending.current.delete(promptId);
        // The server may answer for an older text than the builder showed (the autosave had not
        // landed): remembering its text makes the next landed save read again.
        known.current.set(promptId, answered);
        setByPrompt((current) => ({ ...current, [promptId]: state }));
      };
      void loadPromptProsodyAction(exerciseId, promptId)
        .then((result) => {
          if (result.ok && result.value.status === 'loaded') {
            settle({ status: 'loaded', view: result.value.view }, result.value.view.text);
          } else {
            settle({ status: result.ok ? 'absent' : 'failed' }, result.ok ? '' : text);
          }
        })
        .catch(() => settle({ status: 'failed' }, text));
    },
    [exerciseId],
  );

  useEffect(() => {
    if (!on) return;
    for (const prompt of promptsRef.current) {
      if (prompt.text.trim() === '') continue;
      if (known.current.get(prompt.id) === prompt.text) continue;
      if (pending.current.get(prompt.id)?.text === prompt.text) continue;
      read(prompt.id, prompt.text);
    }
    // `updatedAt` is the trigger: the texts are what the server holds once a save has landed.
  }, [on, exercise.updatedAt, read]);

  const setView = useCallback((promptId: string, view: PromptProsodyAuthoring) => {
    pending.current.delete(promptId);
    known.current.set(promptId, view.text);
    setByPrompt((current) => ({ ...current, [promptId]: { status: 'loaded', view } }));
  }, []);

  const reload = useCallback(
    (promptId: string) => {
      const prompt = promptsRef.current.find((p) => p.id === promptId);
      if (prompt && prompt.text.trim() !== '') read(promptId, prompt.text);
    },
    [read],
  );

  const guide = useMemo(() => {
    const out: Record<string, GuidePrompt> = {};
    for (const prompt of exercise.prompts) {
      const state = byPrompt[prompt.id];
      if (state?.status !== 'loaded' || state.view.text !== prompt.text) continue;
      out[prompt.id] = { layer: state.view.layer, unresolved: state.view.lexicon.unresolved };
    }
    return out;
  }, [byPrompt, exercise.prompts]);

  return { byPrompt, guide, setView, reload };
}

'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  guideShown,
  type GuidePrompt,
  type ReadAloudContent,
} from '@/lib/shared-kernel/read-aloud';

import type { ProsodyIssue, ProsodyLayer } from '@/lib/shared-kernel/prosody';

import {
  loadPromptProsodyAction,
  savePromptProsodyAction,
  suggestPromptProsodyAction,
  type PromptProsodyAuthoring,
} from '../../actions/prosody';
import type { ProsodySuggestion } from '../prosody-editor';

/** As the document's autosave (`use-read-aloud-autosave.ts`): the author never presses save. */
const SAVE_DEBOUNCE_MS = 850;

export type PromptProsodyState =
  | { status: 'loading' }
  | { status: 'loaded'; view: PromptProsodyAuthoring }
  /** No passage on the server yet — nothing to mark. */
  | { status: 'absent' }
  | { status: 'failed' };

/** Where the author's marks of one prompt are on their way to the server. */
export type LayerSaveState =
  | { status: 'pending' }
  | { status: 'saving' }
  | { status: 'saved' }
  /** Another window saved first: the editor shows what is stored now, the last edit is gone. */
  | { status: 'conflict' }
  /** The server would not lay the marks on its text — usually the text changed meanwhile. */
  | { status: 'invalid'; issues: ProsodyIssue[]; errors: string[] }
  /** Not saved; the edit is kept and `retry` sends it again. */
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
  /** The layer the editor shows: an edit not saved yet, else the server's. */
  layerOf: (promptId: string) => ProsodyLayer | null;
  /** By prompt id; a prompt never edited in this session is missing. */
  saves: Readonly<Record<string, LayerSaveState>>;
  /** The author changed the marks: shown at once, saved after a pause. */
  edit: (promptId: string, layer: ProsodyLayer) => void;
  /** Send a failed save again. */
  retry: (promptId: string) => void;
  /** After a save or a suggestion: the view the server answered with. */
  setView: (promptId: string, view: PromptProsodyAuthoring) => void;
  reload: (promptId: string) => void;
  /**
   * ✦ The agent's phrase marks for the prompt's saved passage. Nothing is stored or drafted:
   * the editor proposes them and an accepted sentence comes back through `edit`.
   */
  suggest: (promptId: string) => Promise<ProsodySuggestion>;
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
 *
 * An edit of the marks is held as a draft layer — the rail and the editor judge it at once — and
 * saved on its own, apart from the document (§4r): `PUT { layer, expectedUpdatedAt }` with the
 * `updatedAt` of the view it was made on. One save per prompt at a time; an edit made while one
 * is in flight goes next, on the time that save answered. A 409 drops the draft and reads again.
 */
export function usePromptProsody({ exerciseId, exercise }: UsePromptProsodyOptions): PromptProsody {
  const [byPrompt, setByPrompt] = useState<Record<string, PromptProsodyState>>({});
  const [drafts, setDrafts] = useState<Record<string, ProsodyLayer>>({});
  const [saves, setSaves] = useState<Record<string, LayerSaveState>>({});
  /** Mirrors for the save path, which runs outside a render. */
  const viewsRef = useRef<Record<string, PromptProsodyState>>({});
  const draftsRef = useRef<Record<string, ProsodyLayer>>({});
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const inFlight = useRef<Set<string>>(new Set());
  /** The text the server last answered for each prompt — what its view is anchored to. */
  const known = useRef<Map<string, string>>(new Map());
  /** The latest read per prompt: the text the builder showed and a ticket that outdates older reads. */
  const pending = useRef<Map<string, { text: string; ticket: number }>>(new Map());
  const tickets = useRef(0);

  const on = guideShown(exercise);
  const promptsRef = useRef(exercise.prompts);
  useEffect(() => {
    promptsRef.current = exercise.prompts;
    viewsRef.current = byPrompt;
    draftsRef.current = drafts;
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
        // A draft made on another text would land on the wrong words: the new text starts clean.
        const before = known.current.get(promptId);
        if (before !== undefined && before !== answered && !inFlight.current.has(promptId)) {
          const { [promptId]: _stale, ...rest } = draftsRef.current;
          draftsRef.current = rest;
          setDrafts(rest);
        }
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

  const dropDraft = useCallback((promptId: string) => {
    delete draftsRef.current[promptId];
    setDrafts((current) => {
      const { [promptId]: _gone, ...rest } = current;
      return rest;
    });
  }, []);

  // The save that finds a newer edit sends it next, through the latest `flush`.
  const flushRef = useRef<(promptId: string) => void>(() => undefined);
  const flush = useCallback(
    (promptId: string) => {
      timers.current.delete(promptId);
      if (inFlight.current.has(promptId)) return;
      const layer = draftsRef.current[promptId];
      const state = viewsRef.current[promptId];
      if (layer === undefined || state?.status !== 'loaded') return;
      inFlight.current.add(promptId);
      setSaves((current) => ({ ...current, [promptId]: { status: 'saving' } }));

      const done = (next: LayerSaveState) => {
        inFlight.current.delete(promptId);
        setSaves((current) => ({ ...current, [promptId]: next }));
      };
      void savePromptProsodyAction(exerciseId, promptId, {
        layer,
        expectedUpdatedAt: state.view.updatedAt,
      })
        .then((result) => {
          if (!result.ok) return done({ status: 'failed' });
          const outcome = result.value;
          if (outcome.status === 'saved') {
            // Set before the next flush reads it: a newer edit is saved on this answer's time.
            viewsRef.current = {
              ...viewsRef.current,
              [promptId]: { status: 'loaded', view: outcome.view },
            };
            known.current.set(promptId, outcome.view.text);
            setByPrompt((current) => ({
              ...current,
              [promptId]: { status: 'loaded', view: outcome.view },
            }));
            const newer = draftsRef.current[promptId] !== layer;
            if (!newer) dropDraft(promptId);
            done(newer ? { status: 'pending' } : { status: 'saved' });
            if (newer) flushRef.current(promptId);
            return;
          }
          dropDraft(promptId);
          done(
            outcome.status === 'conflict'
              ? { status: 'conflict' }
              : { status: 'invalid', issues: outcome.issues, errors: outcome.errors },
          );
          const prompt = promptsRef.current.find((p) => p.id === promptId);
          if (prompt && prompt.text.trim() !== '') read(promptId, prompt.text);
        })
        .catch(() => done({ status: 'failed' }));
    },
    [exerciseId, dropDraft, read],
  );

  useEffect(() => {
    flushRef.current = flush;
  });

  const edit = useCallback(
    (promptId: string, layer: ProsodyLayer) => {
      draftsRef.current = { ...draftsRef.current, [promptId]: layer };
      setDrafts((current) => ({ ...current, [promptId]: layer }));
      setSaves((current) =>
        current[promptId]?.status === 'saving'
          ? current
          : { ...current, [promptId]: { status: 'pending' } },
      );
      const timer = timers.current.get(promptId);
      if (timer !== undefined) clearTimeout(timer);
      timers.current.set(
        promptId,
        setTimeout(() => flush(promptId), SAVE_DEBOUNCE_MS),
      );
    },
    [flush],
  );

  const retry = useCallback((promptId: string) => flush(promptId), [flush]);

  // Leaving the builder sends what is waiting rather than dropping it.
  useEffect(() => {
    const waiting = timers.current;
    return () => {
      for (const [promptId, timer] of waiting) {
        clearTimeout(timer);
        flush(promptId);
      }
    };
  }, [flush]);

  const layerOf = useCallback(
    (promptId: string): ProsodyLayer | null => {
      const state = byPrompt[promptId];
      return drafts[promptId] ?? (state?.status === 'loaded' ? state.view.layer : null);
    },
    [byPrompt, drafts],
  );

  const guide = useMemo(() => {
    const out: Record<string, GuidePrompt> = {};
    for (const prompt of exercise.prompts) {
      const state = byPrompt[prompt.id];
      if (state?.status !== 'loaded' || state.view.text !== prompt.text) continue;
      out[prompt.id] = {
        layer: drafts[prompt.id] ?? state.view.layer,
        unresolved: state.view.lexicon.unresolved,
      };
    }
    return out;
  }, [byPrompt, drafts, exercise.prompts]);

  const suggest = useCallback(
    async (promptId: string): Promise<ProsodySuggestion> => {
      const result = await suggestPromptProsodyAction(exerciseId, promptId);
      if (!result.ok) return { status: 'failed' };
      const outcome = result.value;
      return outcome.status === 'suggested'
        ? { status: 'suggested', text: outcome.view.text, layer: outcome.view.layer }
        : outcome;
    },
    [exerciseId],
  );

  return { byPrompt, guide, layerOf, saves, edit, retry, setView, reload, suggest };
}

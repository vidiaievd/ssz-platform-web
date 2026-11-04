'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import type { Result } from '@/lib/result';
import type { ProsodyIssue, ProsodyLayer } from '@/lib/shared-kernel/prosody';

import type {
  PromptProsodyAuthoring,
  PromptProsodyLoad,
  SavePromptProsodyInput,
  SavePromptProsodyOutcome,
  SuggestPromptProsodyOutcome,
} from '../../actions/prosody';
import type { ProsodySuggestion } from './prosody-editor';

/** As the document's autosave (`use-read-aloud-autosave.ts`): the author never presses save. */
const SAVE_DEBOUNCE_MS = 850;

export type ProsodyLayerState =
  | { status: 'loading' }
  | { status: 'loaded'; view: PromptProsodyAuthoring }
  /** No text on the server yet — nothing to mark. */
  | { status: 'absent' }
  | { status: 'failed' };

/** Where the author's marks of one passage are on their way to the server. */
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

/** The owner's routes for one kind of passage, by passage id — the server actions, bound. */
export interface ProsodyLayerApi {
  load: (id: string) => Promise<Result<PromptProsodyLoad>>;
  save: (id: string, input: SavePromptProsodyInput) => Promise<Result<SavePromptProsodyOutcome>>;
  suggest: (id: string) => Promise<Result<SuggestPromptProsodyOutcome>>;
}

export interface ProsodyLayers {
  /** By passage id; a passage never read is missing. */
  byPassage: Readonly<Record<string, ProsodyLayerState>>;
  /** The layer the editor shows: an edit not saved yet, else the server's. */
  layerOf: (id: string) => ProsodyLayer | null;
  /** By passage id; a passage never edited in this session is missing. */
  saves: Readonly<Record<string, LayerSaveState>>;
  /** The author changed the marks: shown at once, saved after a pause. */
  edit: (id: string, layer: ProsodyLayer) => void;
  /** Send a failed save again. */
  retry: (id: string) => void;
  /** After a save or a suggestion: the view the server answered with. */
  setView: (id: string, view: PromptProsodyAuthoring) => void;
  reload: (id: string) => void;
  /**
   * ✦ The agent's phrase marks for the passage's saved text. Nothing is stored or drafted:
   * the editor proposes them and an accepted sentence comes back through `edit`.
   */
  suggest: (id: string) => Promise<ProsodySuggestion>;
}

export interface UseProsodyLayersOptions {
  /** Stable across renders (memoised by the owner): a new object reads nothing again by itself. */
  api: ProsodyLayerApi;
  /** The texts the owner shows now, by id; an empty text is never read. */
  passages: readonly { id: string; text: string }[];
  /** Nothing is read while off. */
  on: boolean;
  /**
   * Moves when the owner's text save lands — the server then holds the texts in `passages`,
   * and a passage whose text differs from the one last read is read again.
   */
  revision: string;
}

/**
 * The marks of the passages of one owner — the prompts of a `read_aloud` exercise or the body
 * of a lesson (plan 86, steps 6h.3 and 6h.4) — read, held and saved beside the owner's own text.
 *
 * The server re-anchors the stored layer to the **saved** text, so a passage is read when `on`
 * and again each time `revision` moves with a text that differs from the one last read.
 *
 * An edit of the marks is held as a draft layer — the owner's checks and the editor judge it at
 * once — and saved on its own, apart from the text (§4r): `PUT { layer, expectedUpdatedAt }`
 * with the `updatedAt` of the view it was made on. One save per passage at a time; an edit made
 * while one is in flight goes next, on the time that save answered. A 409 drops the draft and
 * reads again.
 */
export function useProsodyLayers({
  api,
  passages,
  on,
  revision,
}: UseProsodyLayersOptions): ProsodyLayers {
  const [byPassage, setByPassage] = useState<Record<string, ProsodyLayerState>>({});
  const [drafts, setDrafts] = useState<Record<string, ProsodyLayer>>({});
  const [saves, setSaves] = useState<Record<string, LayerSaveState>>({});
  /** Mirrors for the save path, which runs outside a render. */
  const viewsRef = useRef<Record<string, ProsodyLayerState>>({});
  const draftsRef = useRef<Record<string, ProsodyLayer>>({});
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const inFlight = useRef<Set<string>>(new Set());
  /** The text the server last answered for each passage — what its view is anchored to. */
  const known = useRef<Map<string, string>>(new Map());
  /** The latest read per passage: the text the owner showed, a ticket that outdates older reads. */
  const pending = useRef<Map<string, { text: string; ticket: number }>>(new Map());
  const tickets = useRef(0);

  const passagesRef = useRef(passages);
  useEffect(() => {
    passagesRef.current = passages;
    viewsRef.current = byPassage;
    draftsRef.current = drafts;
  });

  const read = useCallback(
    (id: string, text: string) => {
      const ticket = ++tickets.current;
      pending.current.set(id, { text, ticket });
      setByPassage((current) => ({ ...current, [id]: { status: 'loading' } }));
      const settle = (state: ProsodyLayerState, answered: string) => {
        // A later read of the same passage has taken over.
        if (pending.current.get(id)?.ticket !== ticket) return;
        pending.current.delete(id);
        // A draft made on another text would land on the wrong words: the new text starts clean.
        const before = known.current.get(id);
        if (before !== undefined && before !== answered && !inFlight.current.has(id)) {
          const { [id]: _stale, ...rest } = draftsRef.current;
          draftsRef.current = rest;
          setDrafts(rest);
        }
        // The server may answer for an older text than the owner showed (the autosave had not
        // landed): remembering its text makes the next landed save read again.
        known.current.set(id, answered);
        setByPassage((current) => ({ ...current, [id]: state }));
      };
      void api
        .load(id)
        .then((result) => {
          if (result.ok && result.value.status === 'loaded') {
            settle({ status: 'loaded', view: result.value.view }, result.value.view.text);
          } else {
            settle({ status: result.ok ? 'absent' : 'failed' }, result.ok ? '' : text);
          }
        })
        .catch(() => settle({ status: 'failed' }, text));
    },
    [api],
  );

  useEffect(() => {
    if (!on) return;
    for (const passage of passagesRef.current) {
      if (passage.text.trim() === '') continue;
      if (known.current.get(passage.id) === passage.text) continue;
      if (pending.current.get(passage.id)?.text === passage.text) continue;
      read(passage.id, passage.text);
    }
    // `revision` is the trigger: the texts are what the server holds once a save has landed.
  }, [on, revision, read]);

  const setView = useCallback((id: string, view: PromptProsodyAuthoring) => {
    pending.current.delete(id);
    known.current.set(id, view.text);
    setByPassage((current) => ({ ...current, [id]: { status: 'loaded', view } }));
  }, []);

  const reload = useCallback(
    (id: string) => {
      const passage = passagesRef.current.find((p) => p.id === id);
      if (passage && passage.text.trim() !== '') read(id, passage.text);
    },
    [read],
  );

  const dropDraft = useCallback((id: string) => {
    delete draftsRef.current[id];
    setDrafts((current) => {
      const { [id]: _gone, ...rest } = current;
      return rest;
    });
  }, []);

  // The save that finds a newer edit sends it next, through the latest `flush`.
  const flushRef = useRef<(id: string) => void>(() => undefined);
  const flush = useCallback(
    (id: string) => {
      timers.current.delete(id);
      if (inFlight.current.has(id)) return;
      const layer = draftsRef.current[id];
      const state = viewsRef.current[id];
      if (layer === undefined || state?.status !== 'loaded') return;
      inFlight.current.add(id);
      setSaves((current) => ({ ...current, [id]: { status: 'saving' } }));

      const done = (next: LayerSaveState) => {
        inFlight.current.delete(id);
        setSaves((current) => ({ ...current, [id]: next }));
      };
      void api
        .save(id, {
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
              [id]: { status: 'loaded', view: outcome.view },
            };
            known.current.set(id, outcome.view.text);
            setByPassage((current) => ({
              ...current,
              [id]: { status: 'loaded', view: outcome.view },
            }));
            const newer = draftsRef.current[id] !== layer;
            if (!newer) dropDraft(id);
            done(newer ? { status: 'pending' } : { status: 'saved' });
            if (newer) flushRef.current(id);
            return;
          }
          dropDraft(id);
          done(
            outcome.status === 'conflict'
              ? { status: 'conflict' }
              : { status: 'invalid', issues: outcome.issues, errors: outcome.errors },
          );
          const passage = passagesRef.current.find((p) => p.id === id);
          if (passage && passage.text.trim() !== '') read(id, passage.text);
        })
        .catch(() => done({ status: 'failed' }));
    },
    [api, dropDraft, read],
  );

  useEffect(() => {
    flushRef.current = flush;
  });

  const edit = useCallback(
    (id: string, layer: ProsodyLayer) => {
      draftsRef.current = { ...draftsRef.current, [id]: layer };
      setDrafts((current) => ({ ...current, [id]: layer }));
      setSaves((current) =>
        current[id]?.status === 'saving' ? current : { ...current, [id]: { status: 'pending' } },
      );
      const timer = timers.current.get(id);
      if (timer !== undefined) clearTimeout(timer);
      timers.current.set(
        id,
        setTimeout(() => flush(id), SAVE_DEBOUNCE_MS),
      );
    },
    [flush],
  );

  const retry = useCallback((id: string) => flush(id), [flush]);

  // Leaving the owner sends what is waiting rather than dropping it.
  useEffect(() => {
    const waiting = timers.current;
    return () => {
      for (const [id, timer] of waiting) {
        clearTimeout(timer);
        flush(id);
      }
    };
  }, [flush]);

  const layerOf = useCallback(
    (id: string): ProsodyLayer | null => {
      const state = byPassage[id];
      return drafts[id] ?? (state?.status === 'loaded' ? state.view.layer : null);
    },
    [byPassage, drafts],
  );

  const suggest = useCallback(
    async (id: string): Promise<ProsodySuggestion> => {
      const result = await api.suggest(id);
      if (!result.ok) return { status: 'failed' };
      const outcome = result.value;
      return outcome.status === 'suggested'
        ? { status: 'suggested', text: outcome.view.text, layer: outcome.view.layer }
        : outcome;
    },
    [api],
  );

  return { byPassage, layerOf, saves, edit, retry, setView, reload, suggest };
}

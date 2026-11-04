'use server';

import { serverFetch } from '@/lib/api/server-fetcher';
import { isAppError } from '@/lib/errors';
import { err, ok, type Result } from '@/lib/result';
import type {
  ProsodyAnchor,
  ProsodyIssue,
  ProsodyLayer,
  WordSounds,
  WordStress,
} from '@/lib/shared-kernel/prosody';

/**
 * What content-service gives the editor of one `read_aloud` prompt's marks (plan 86, §4q):
 * the stored layer anchored to the passage the builder edits (the draft), and what the lexicon
 * says under the same text.
 */
export interface PromptProsodyAuthoring {
  text: string;
  notation: string;
  dropped: number;
  /** Orphans included. */
  layer: ProsodyLayer;
  issues: ProsodyIssue[];
  /** ISO; null — nothing stored yet. The save's concurrency token. */
  updatedAt: string | null;
  lexicon: {
    stresses: WordStress[];
    sounds: WordSounds[];
    /** Words the author must settle with a stress or «no stress» when the guide is on. */
    unresolved: ProsodyAnchor[];
  };
}

export type PromptProsodyLoad =
  | { status: 'loaded'; view: PromptProsodyAuthoring }
  /** The prompt has no passage yet, or the draft has no such prompt (not saved yet). */
  | { status: 'absent' };

/**
 * The marks of one prompt, as the author sees them.
 *
 * Read against the **draft** passage on the server — the builder's text reaches it with the
 * autosave, so the caller reads again once the text it shows has been saved.
 */
export async function loadPromptProsodyAction(
  exerciseId: string,
  promptId: string,
): Promise<Result<PromptProsodyLoad>> {
  try {
    const view = await serverFetch<PromptProsodyAuthoring>({
      service: 'content',
      path: `/exercises/${exerciseId}/prompts/${encodeURIComponent(promptId)}/prosody/authoring`,
      expectedErrorStatuses: [404, 422],
    });
    return ok({ status: 'loaded', view });
  } catch (error) {
    if (
      isAppError(error) &&
      (error.code === 'not_found' || upstreamMessage(error.details) === 'PROMPT_HAS_NO_TEXT')
    ) {
      return ok({ status: 'absent' });
    }
    if (isAppError(error)) return err(error.toJSON());
    throw error;
  }
}

export interface SavePromptProsodyInput {
  /** Re-anchored to the passage; sources `teacher` / `ai` only — lexicon words are never sent. */
  layer: ProsodyLayer;
  /** The `updatedAt` the editor read; null — it read «nothing stored». */
  expectedUpdatedAt: string | null;
}

export type SavePromptProsodyOutcome =
  | { status: 'saved'; view: PromptProsodyAuthoring }
  /** Another save came first; null — the layer was removed meanwhile. */
  | { status: 'conflict'; currentUpdatedAt: string | null }
  /** The server would not lay the marks on its text (`LAYER_INVALID` / `LAYER_MALFORMED`). */
  | { status: 'invalid'; issues: ProsodyIssue[]; errors: string[] };

/**
 * Autosave of one prompt's layer (§4r). Separate from the document's autosave: the layer is
 * shared by the draft and the published version and applies without publishing.
 */
export async function savePromptProsodyAction(
  exerciseId: string,
  promptId: string,
  input: SavePromptProsodyInput,
): Promise<Result<SavePromptProsodyOutcome>> {
  try {
    const view = await serverFetch<PromptProsodyAuthoring>({
      service: 'content',
      path: `/exercises/${exerciseId}/prompts/${encodeURIComponent(promptId)}/prosody`,
      method: 'PUT',
      body: { layer: input.layer, expectedUpdatedAt: input.expectedUpdatedAt },
      expectedErrorStatuses: [400, 409],
    });
    return ok({ status: 'saved', view });
  } catch (error) {
    if (isAppError(error) && error.code === 'conflict') {
      return ok({
        status: 'conflict',
        currentUpdatedAt: readField(error.details, 'currentUpdatedAt'),
      });
    }
    if (isAppError(error) && error.code === 'validation') {
      const code = upstreamMessage(error.details);
      if (code === 'LAYER_INVALID' || code === 'LAYER_MALFORMED') {
        return ok({
          status: 'invalid',
          issues: readList<ProsodyIssue>(error.details, 'issues'),
          errors: readList<string>(error.details, 'errors'),
        });
      }
    }
    if (isAppError(error)) return err(error.toJSON());
    throw error;
  }
}

export type SuggestionRefusal =
  | 'language_not_supported'
  | 'no_words'
  | 'too_long'
  | 'not_available'
  | 'pool_empty';

export type SuggestPromptProsodyOutcome =
  /** The authoring view of the proposal — nothing is stored until the author saves it. */
  | { status: 'suggested'; view: PromptProsodyAuthoring }
  | { status: 'refused'; reason: SuggestionRefusal }
  | { status: 'failed' };

/** ✦ Suggest phrase marks (§4e, step 5c.2), spending `ai.authoring` credits of the owner. */
export async function suggestPromptProsodyAction(
  exerciseId: string,
  promptId: string,
): Promise<Result<SuggestPromptProsodyOutcome>> {
  try {
    const view = await serverFetch<PromptProsodyAuthoring>({
      service: 'content',
      path: `/exercises/${exerciseId}/prompts/${encodeURIComponent(promptId)}/prosody/suggestion`,
      method: 'POST',
      expectedErrorStatuses: [422, 502],
      // A language model answers: the default upstream timeout is for plain reads.
      timeoutMs: 60_000,
    });
    return ok({ status: 'suggested', view });
  } catch (error) {
    if (isAppError(error) && upstreamMessage(error.details) === 'SUGGESTION_REFUSED') {
      const reason = readField(error.details, 'reason');
      return ok({ status: 'refused', reason: (reason ?? 'not_available') as SuggestionRefusal });
    }
    if (isAppError(error) && upstreamMessage(error.details) === 'SUGGESTION_FAILED') {
      return ok({ status: 'failed' });
    }
    if (isAppError(error)) return err(error.toJSON());
    throw error;
  }
}

function upstreamMessage(details: unknown): string | null {
  return readField(details, 'message');
}

function readField(details: unknown, key: string): string | null {
  if (typeof details !== 'object' || details === null) return null;
  const value = (details as Record<string, unknown>)[key];
  return typeof value === 'string' ? value : null;
}

function readList<T>(details: unknown, key: string): T[] {
  if (typeof details !== 'object' || details === null) return [];
  const value = (details as Record<string, unknown>)[key];
  return Array.isArray(value) ? (value as T[]) : [];
}

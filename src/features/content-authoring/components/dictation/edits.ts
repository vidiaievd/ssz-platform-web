import type { AudioDraft, ExerciseAudio } from '@/lib/shared-kernel/audio';
import {
  addSegment as addSegmentTo,
  applySplit as applySplitTo,
  canPutBack as canPutBackIn,
  dropOrphan as dropOrphanFrom,
  packOf,
  putBack as putBackIn,
  removeSegment as removeSegmentFrom,
  setFocusWhy as setFocusWhyOf,
  setMode as setModeOf,
  setSegmentAudio as setSegmentAudioOf,
  setSegmentText as setSegmentTextOf,
  setSegmentWhy as setSegmentWhyOf,
  toggleFocus as toggleFocusOf,
  update,
  updateMarking,
  updateSettings,
  type DictationContent,
  type Marking,
  type Mode,
  type Settings,
} from '@/lib/shared-kernel/dictation';

/**
 * The builder's edits, as thin wrappers over the kernel's (plan 68 §4.1).
 *
 * Every cascade — re-anchoring focus words on a text edit, a deleted sentence taking its
 * orphans with it, the join into one text, the ceiling of eight — is the kernel's and is
 * tested there. What is here is only the shape: the builder holds a document that carries
 * more than the kernel's (`updatedAt`), and the kernel returns the plain content. `keep`
 * lays the result over the document so the extras survive.
 */
type Doc = DictationContent;

/** The document as the builder holds it: the kernel's content plus the row's token. */
export interface DictationDocument extends DictationContent {
  /** ISO. Doubles as the autosave concurrency token. */
  updatedAt: string;
}

function keep<T extends Doc>(ex: T, next: Doc): T {
  return { ...ex, ...next };
}

export function setTitle<T extends Doc>(ex: T, title: string): T {
  return keep(ex, update(ex, { title }));
}

export function setInstruction<T extends Doc>(ex: T, instruction: string): T {
  return keep(ex, update(ex, { instruction }));
}

// ── The recording ───────────────────────────────────────────────────────────

/**
 * The audio block as the layer's cards take it. A dictation keeps the timecodes on its
 * segments, not in a map beside the document, so the draft's map is empty: the cards that
 * read it for a dictation (the source card) never look at timecodes.
 */
export function audioDraftOf(ex: Doc): AudioDraft {
  return { audio: ex.audio, segments: {}, present: true };
}

/** A card changed the block. Listening is always on for this type («cannot be turned off»). */
export function withAudioDraft<T extends Doc>(ex: T, next: AudioDraft): T {
  const audio: ExerciseAudio = { ...next.audio, enabled: true };
  return keep(ex, update(ex, { audio }));
}

// ── The key ─────────────────────────────────────────────────────────────────

export function setMode<T extends Doc>(ex: T, mode: Mode): T {
  return keep(ex, setModeOf(ex, mode));
}

export function setSegmentText<T extends Doc>(ex: T, id: string, text: string): T {
  return keep(ex, setSegmentTextOf(ex, id, text));
}

export function setSegmentAudio<T extends Doc>(
  ex: T,
  id: string,
  audio: { start: number; end: number } | null,
): T {
  return keep(ex, setSegmentAudioOf(ex, id, audio));
}

/**
 * «Set start here» / «Set end» — the player's position becomes one end of the timecode.
 *
 * A timecode is a pair, so the other end comes from the one already there. With none yet, a
 * start takes the position for both ends and an end starts at 0:00 — the pair is then empty
 * or inverted until the author sets the other end, which the audio layer says in words.
 * Positions are whole seconds, the resolution the field shows.
 */
export function setTimecodeEdge<T extends Doc>(
  ex: T,
  id: string,
  edge: 'start' | 'end',
  position: number,
): T {
  const seg = ex.segments.find((s) => s.id === id);
  if (!seg) return ex;
  const at = Math.round(position);
  const next =
    edge === 'start'
      ? { start: at, end: seg.audio?.end ?? at }
      : { start: seg.audio?.start ?? 0, end: at };
  return setSegmentAudio(ex, id, next);
}

/** Appends an empty sentence and says which one it is. */
export function addSegment<T extends Doc>(ex: T): { ex: T; added: string | null } {
  const next = addSegmentTo(ex);
  const added =
    next.segments.length > ex.segments.length ? (next.segments.at(-1)?.id ?? null) : null;
  return { ex: keep(ex, next), added };
}

export function removeSegment<T extends Doc>(ex: T, id: string): T {
  return keep(ex, removeSegmentFrom(ex, id));
}

/**
 * *Paste and split* with the language pack of the course the document was made in. `estimated`
 * names the segments whose timecode is a guess — the builder labels them until they are set.
 */
export function applySplit<T extends Doc>(ex: T, text: string): { ex: T; estimated: string[] } {
  const result = applySplitTo(ex, text, packOf(ex.language));
  return { ex: keep(ex, result.ex), estimated: result.estimated };
}

// ── Marking and delivery ────────────────────────────────────────────────────

export function setMarking<T extends Doc>(ex: T, patch: Partial<Marking>): T {
  return keep(ex, updateMarking(ex, patch));
}

export function setSettings<T extends Doc>(ex: T, patch: Partial<Settings>): T {
  return keep(ex, updateSettings(ex, patch));
}

/** A click on a word: it becomes a focus word with no reason yet, or stops being one. */
export function toggleFocus<T extends Doc>(ex: T, segmentId: string, wordIndex: number): T {
  return keep(ex, toggleFocusOf(ex, segmentId, wordIndex));
}

export function setFocusWhy<T extends Doc>(
  ex: T,
  segmentId: string,
  focusId: string,
  why: string,
): T {
  return keep(ex, setFocusWhyOf(ex, segmentId, focusId, why));
}

export function setSegmentWhy<T extends Doc>(ex: T, id: string, why: string): T {
  return keep(ex, setSegmentWhyOf(ex, id, why));
}

export function canPutBack(ex: Doc, orphanId: string): boolean {
  return canPutBackIn(ex, orphanId);
}

export function putBack<T extends Doc>(ex: T, orphanId: string): T {
  return keep(ex, putBackIn(ex, orphanId));
}

export function dropOrphan<T extends Doc>(ex: T, orphanId: string): T {
  return keep(ex, dropOrphanFrom(ex, orphanId));
}

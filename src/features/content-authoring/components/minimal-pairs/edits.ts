import {
  addPair as addPairTo,
  addWord as addWordTo,
  clearClip as clearClipOf,
  insertFromLibrary as insertFromLibraryInto,
  relabelVoice as relabelVoiceOf,
  removePair as removePairFrom,
  removeWord as removeWordFrom,
  setClip as setClipOf,
  setContrast as setContrastOf,
  setDialect as setDialectOf,
  setFeedback as setFeedbackOf,
  setInstruction as setInstructionOf,
  setPairContrast as setPairContrastOf,
  setPairNote as setPairNoteOf,
  setPassPct as setPassPctOf,
  setProbes as setProbesOf,
  setScoring as setScoringOf,
  setSet as setSetOf,
  setTitle as setTitleOf,
  setWord as setWordOf,
  type MinimalPairsContent,
} from '@/lib/shared-kernel/minimal-pairs';

/**
 * The builder's edits, as thin wrappers over the kernel's (plan 72 §4.1).
 *
 * Every limit — at least one pair, two or three words a pair, 2–30 probes, a pass mark of
 * 0–100 — and every cascade (a library pair replacing the empty ones, a pair's contrast reset
 * when it matches the exercise's, a relabel touching only recorded words) is the kernel's and is
 * tested there. `lift` lays the kernel's result over the builder's document so the row's token
 * survives.
 */
type Doc = MinimalPairsContent;

/** The document as the builder holds it: the kernel's content plus the row's token. */
export interface MinimalPairsDocument extends MinimalPairsContent {
  /** ISO. Doubles as the autosave concurrency token. */
  updatedAt: string;
}

/** What a step changes the document with — a value, or an edit of the latest one. */
export type DocumentUpdate = (
  next: MinimalPairsDocument | ((current: MinimalPairsDocument) => MinimalPairsDocument),
) => void;

function lift<A extends unknown[]>(edit: (ex: Doc, ...args: A) => Doc) {
  return <T extends Doc>(ex: T, ...args: A): T => ({ ...ex, ...edit(ex, ...args) });
}

export const setTitle = lift(setTitleOf);
export const setInstruction = lift(setInstructionOf);
export const setContrast = lift(setContrastOf);

export const addPair = lift(addPairTo);
export const removePair = lift(removePairFrom);
export const insertFromLibrary = lift(insertFromLibraryInto);
export const setPairNote = lift(setPairNoteOf);
export const setPairContrast = lift(setPairContrastOf);

export const addWord = lift(addWordTo);
export const removeWord = lift(removeWordFrom);
export const setWord = lift(setWordOf);

export const setClip = lift(setClipOf);
export const clearClip = lift(clearClipOf);
export const relabelVoice = lift(relabelVoiceOf);
export const setDialect = lift(setDialectOf);

export const setSet = lift(setSetOf);
export const setProbes = lift(setProbesOf);
export const setFeedback = lift(setFeedbackOf);
export const setScoring = lift(setScoringOf);
export const setPassPct = lift(setPassPctOf);

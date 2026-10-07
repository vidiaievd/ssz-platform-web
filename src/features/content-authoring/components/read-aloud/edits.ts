import type { AudioDraft } from '@/lib/shared-kernel/audio';
import {
  addCriterion as addCriterionTo,
  addPoint as addPointTo,
  addPrompt as addPromptTo,
  removeCriterion as removeCriterionFrom,
  removeFocus as removeFocusFrom,
  removePoint as removePointFrom,
  removePrompt as removePromptFrom,
  setAi as setAiOf,
  setCriterion as setCriterionOf,
  setFocusNote as setFocusNoteOf,
  setInstruction as setInstructionOf,
  setLevel as setLevelOf,
  setMode as setModeOf,
  setNote as setNoteOf,
  setPassScore as setPassScoreOf,
  setPointText as setPointTextOf,
  setPrompt as setPromptOf,
  setRecording as setRecordingOf,
  setReview as setReviewOf,
  setSeconds as setSecondsOf,
  setSettings as setSettingsOf,
  setTitle as setTitleOf,
  setWeight as setWeightOf,
  toggleFocusWord as toggleFocusWordOf,
  togglePointRequired as togglePointRequiredOf,
  toggleStudentVisible as toggleStudentVisibleOf,
  type ReadAloudContent,
} from '@/lib/shared-kernel/read-aloud';

/**
 * The builder's edits, as thin wrappers over the kernel's (plan 70 §4.1).
 *
 * Every limit — one to six prompts, two to five criteria, one to three takes, preparation up to
 * two minutes, a pass mark not below zero — and every cascade (a mode switch resetting the three
 * lengths and keeping the material, a focus word compared without case) is the kernel's and is
 * tested there. What is here is only the shape: the builder holds a document that carries more
 * than the kernel's (`updatedAt`, the audio layer), and the kernel returns the plain content.
 * `lift` lays the result over the document so the extras survive.
 */
type Doc = ReadAloudContent;

/**
 * The document as the builder holds it: the kernel's content plus the row's token and the audio
 * layer's draft (plan 56). Same envelope as `inflection_table` and `highlight_in_text`: the layer
 * belongs to no template, so it rides beside the content, not inside the kernel's model.
 */
export interface ReadAloudDocument extends ReadAloudContent {
  /** ISO. Doubles as the autosave concurrency token. */
  updatedAt: string;
  audio: AudioDraft;
}

function lift<A extends unknown[]>(edit: (ex: Doc, ...args: A) => Doc) {
  return <T extends Doc>(ex: T, ...args: A): T => ({ ...ex, ...edit(ex, ...args) });
}

export const setTitle = lift(setTitleOf);
export const setInstruction = lift(setInstructionOf);
export const setMode = lift(setModeOf);

export const addPrompt = lift(addPromptTo);
export const removePrompt = lift(removePromptFrom);
export const setPrompt = lift(setPromptOf);
export const setSeconds = lift(setSecondsOf);

export const addPoint = lift(addPointTo);
export const setPointText = lift(setPointTextOf);
export const togglePointRequired = lift(togglePointRequiredOf);
export const removePoint = lift(removePointFrom);

export const toggleFocusWord = lift(toggleFocusWordOf);
export const setFocusNote = lift(setFocusNoteOf);
export const removeFocus = lift(removeFocusFrom);
export const setNote = lift(setNoteOf);

export const addCriterion = lift(addCriterionTo);
export const removeCriterion = lift(removeCriterionFrom);
export const setCriterion = lift(setCriterionOf);
export const setWeight = lift(setWeightOf);
export const toggleStudentVisible = lift(toggleStudentVisibleOf);
export const setLevel = lift(setLevelOf);
export const setPassScore = lift(setPassScoreOf);

export const setRecording = lift(setRecordingOf);
export const setSettings = lift(setSettingsOf);
export const setReview = lift(setReviewOf);
export const setAi = lift(setAiOf);

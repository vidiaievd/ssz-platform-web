import type { AudioDraft, ItemAudio } from '@/lib/shared-kernel/audio';
import {
  addField as addFieldTo,
  moveField as moveFieldIn,
  removeExpected as removeExpectedFrom,
  removeField as removeFieldFrom,
  setAnswering as setAnsweringOf,
  setAudio,
  setExpected as setExpectedOf,
  setField as setFieldOf,
  setFieldAudio as setFieldAudioOf,
  setFocus as setFocusOf,
  setForm as setFormOf,
  setGrading as setGradingOf,
  setInstruction as setInstructionOf,
  setLanguage as setLanguageOf,
  setPassage as setPassageOf,
  setPassageTitle as setPassageTitleOf,
  setScoring as setScoringOf,
  setSourceKind as setSourceKindOf,
  setTitle as setTitleOf,
  type Answering,
  type Field,
  type FieldType,
  type Form,
  type Grading,
  type InfFocus,
  type InformationTransferContent,
  type Scoring,
  type SourceKind,
} from '@/lib/shared-kernel/information-transfer';

/**
 * The builder's edits, as thin wrappers over the kernel's (plan 73 §4.1).
 *
 * Every rule — the floor of one field, the trailing empty wording, the switch that turns the
 * audio block on — is the kernel's and is tested there. What is here is only the shape: the
 * builder holds a document that carries more than the kernel's (`updatedAt`), and the kernel
 * returns the plain content. `keep` lays the result over the document so the extras survive.
 */
type Doc = InformationTransferContent;

/** The document as the builder holds it: the kernel's content plus the row's token. */
export interface InformationTransferDocument extends InformationTransferContent {
  /** ISO. Doubles as the autosave concurrency token. */
  updatedAt: string;
}

/** What a step hands its `onChange`: the next document, or a function of the current one. */
export type DocumentUpdate = (
  next:
    | InformationTransferDocument
    | ((current: InformationTransferDocument) => InformationTransferDocument),
) => void;

function keep<T extends Doc>(ex: T, next: Doc): T {
  return { ...ex, ...next };
}

// ── Step 1 — the source ─────────────────────────────────────────────────────

export function setTitle<T extends Doc>(ex: T, title: string): T {
  return keep(ex, setTitleOf(ex, title));
}

export function setInstruction<T extends Doc>(ex: T, instruction: string): T {
  return keep(ex, setInstructionOf(ex, instruction));
}

export function setSourceKind<T extends Doc>(ex: T, sourceKind: SourceKind): T {
  return keep(ex, setSourceKindOf(ex, sourceKind));
}

export function setFocus<T extends Doc>(ex: T, focus: InfFocus): T {
  return keep(ex, setFocusOf(ex, focus));
}

export function setLanguage<T extends Doc>(ex: T, language: string): T {
  return keep(ex, setLanguageOf(ex, language));
}

export function setPassageTitle<T extends Doc>(ex: T, passageTitle: string): T {
  return keep(ex, setPassageTitleOf(ex, passageTitle));
}

export function setPassage<T extends Doc>(ex: T, passage: string): T {
  return keep(ex, setPassageOf(ex, passage));
}

/**
 * The audio block as the layer's cards take it. The timecodes live on the fields, not in a map
 * beside the document, so the draft's map is empty: the cards that read it for this type (the
 * source and the transcript) never look at timecodes.
 */
export function audioDraftOf(ex: Doc): AudioDraft {
  return { audio: ex.audio, segments: {}, present: true };
}

/** A card changed the block. `enabled` is the source switch's, never the card's (plan 73 §3.1). */
export function withAudioDraft<T extends Doc>(ex: T, next: AudioDraft): T {
  return keep(ex, setAudio(ex, { ...next.audio, enabled: ex.sourceKind === 'audio' }));
}

// ── Step 2 — the blank ──────────────────────────────────────────────────────

export function setForm<T extends Doc>(ex: T, patch: Partial<Form>): T {
  return keep(ex, setFormOf(ex, patch));
}

/** A new field at the end — empty, or from «Lift from the source» with its type and value. */
export function addField<T extends Doc>(
  ex: T,
  type?: FieldType,
  value?: string,
  label?: string,
): T {
  return keep(ex, addFieldTo(ex, type, value, label));
}

export function removeField<T extends Doc>(ex: T, fieldId: string): T {
  return keep(ex, removeFieldFrom(ex, fieldId));
}

export function moveField<T extends Doc>(ex: T, index: number, by: -1 | 1): T {
  return keep(ex, moveFieldIn(ex, index, by));
}

export function setField<T extends Doc>(
  ex: T,
  fieldId: string,
  patch: Partial<Omit<Field, 'id'>>,
): T {
  return keep(ex, setFieldOf(ex, fieldId, patch));
}

export function setExpected<T extends Doc>(ex: T, fieldId: string, k: number, value: string): T {
  return keep(ex, setExpectedOf(ex, fieldId, k, value));
}

export function removeExpected<T extends Doc>(ex: T, fieldId: string, k: number): T {
  return keep(ex, removeExpectedFrom(ex, fieldId, k));
}

export function setFieldAudio<T extends Doc>(ex: T, fieldId: string, audio: ItemAudio | null): T {
  return keep(ex, setFieldAudioOf(ex, fieldId, audio));
}

// ── Steps 3–5 — what counts, how it is played, what it rates ────────────────

export function setGrading<T extends Doc>(ex: T, patch: Partial<Grading>): T {
  return keep(ex, setGradingOf(ex, patch));
}

export function setAnswering<T extends Doc>(ex: T, patch: Partial<Answering>): T {
  return keep(ex, setAnsweringOf(ex, patch));
}

/** The pass mark is clamped by the kernel, as the number field of step 5 expects. */
export function setScoring<T extends Doc>(ex: T, patch: Partial<Scoring>): T {
  return keep(ex, setScoringOf(ex, patch));
}

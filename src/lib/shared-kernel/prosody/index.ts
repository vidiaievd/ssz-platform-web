// ---------------------------------------------------------------------------
// GENERATED FILE — DO NOT EDIT.
// Source: ssz-platform/packages/shared-kernel/src/prosody/index.ts
// Regenerate with `npm run kernel:sync`; verify with `npm run kernel:check`.
// ---------------------------------------------------------------------------

export type { ProsodyIssue, ProsodyIssueLevel } from './issues';
export { prosodyIssues } from './issues';
export { mergeProsody } from './merge';
export type {
  GroupBoundary,
  GroupPause,
  GroupPitch,
  PhraseAccent,
  PhraseSource,
  ProsodyAnchor,
  ProsodyElement,
  ProsodyKind,
  ProsodyLayer,
  ProsodyOrphan,
  ProsodySource,
  StressedVowel,
  Toneme,
  WordLink,
  WordStress,
} from './model';
export { anchorLength, anchorWords, elementsOf, emptyProsodyLayer, layerOf } from './model';
export type { NotationIssue, ParsedNotation } from './notation';
export { checkProsodyNotation, parseProsodyNotation, toProsodyNotation } from './notation';
export { reanchorProsody } from './reanchor';
export { isVowelLetter, stressedVowelFrom, syllableStart } from './spelling';

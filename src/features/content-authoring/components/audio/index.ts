// The audio layer, authoring side — plan 56 phase 4.
//
// Written once and mounted per exercise type: the model default, three cards, one field
// and one issue list. Nothing here knows which template it is drawing for, except through
// `itemNoun`.

export {
  AudioEnableRow,
  AudioRulesCard,
  AudioSegmentField,
  AudioSourceCard,
  AudioTranscriptCard,
} from './audio-cards';
export { useAudioIssueCopy } from './audio-issue-copy';
export { foldAudioIntoStep, useAudioGateRows, useAudioProblems } from './audio-problems';

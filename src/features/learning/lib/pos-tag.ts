import type { PartOfSpeech } from '../components/glossary-popover';

/**
 * Content-service part-of-speech values that have a glossary tag of their own.
 * Everything else — pronoun, numeral, phrase — falls to `other`, which is a
 * deliberate flattening: those categories carry no colour in the reader.
 */
const POS_TO_TAG: Record<string, PartOfSpeech> = {
  noun: 'noun',
  verb: 'verb',
  adjective: 'adj',
  adverb: 'adv',
  preposition: 'prep',
  conjunction: 'conj',
};

export function toGlossaryTag(partOfSpeech?: string): PartOfSpeech {
  return (partOfSpeech && POS_TO_TAG[partOfSpeech]) || 'other';
}

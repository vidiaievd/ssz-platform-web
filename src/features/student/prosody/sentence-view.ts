import {
  anchorLength,
  elementsOf,
  layerOf,
  type ProsodyElement,
  type ProsodyLayer,
  type WordSounds,
} from '@/lib/shared-kernel/prosody';
import { splitSentences } from '@/lib/shared-kernel/text/sentences';
import { tokenize } from '@/lib/shared-kernel/text/words';

/** A stretch of text the layer and the sounds are anchored to: a lesson paragraph, a passage of a reading. */
export interface DrillUnit {
  key: string;
  text: string;
  layer: ProsodyLayer;
  sounds: readonly WordSounds[];
}

/** One sentence with its own layer and sounds, anchors renumbered from its first word. */
export interface DrillSentence {
  /** `<unit key>:<n>` */
  key: string;
  /** The unit it is cut from — a reading's prompt id. */
  unitKey: string;
  text: string;
  layer: ProsodyLayer;
  sounds: WordSounds[];
}

/**
 * The markdown signs a sentence may carry (`## `, `- `, `> `, `*`), none of which is a
 * word, so the tokens of the cleaned text are the tokens of the raw one.
 */
function plain(raw: string): string {
  return raw
    .replace(/^\s*(?:#{1,6}\s+|[-*+]\s+|>\s*)/, '')
    .replace(/\*+/g, '')
    .trim();
}

/** The sentences of the units in order (plan 86, step 6f); a unit without a word has none. */
export function drillSentences(units: readonly DrillUnit[]): DrillSentence[] {
  return units.flatMap((unit) => {
    const tokens = tokenize(unit.text);
    const elements = elementsOf(unit.layer);
    return splitSentences(unit.text, tokens).map((sentence): DrillSentence => {
      const { first, end } = sentence;
      const own = elements
        .filter((el) => el.mark.i >= first && el.mark.i + anchorLength(el.kind) <= end)
        .map((el) => ({ ...el, mark: { ...el.mark, i: el.mark.i - first } }) as ProsodyElement);
      return {
        key: `${unit.key}:${sentence.index}`,
        unitKey: unit.key,
        text: plain(unit.text.slice(sentence.s, sentence.e)),
        layer: layerOf(own),
        sounds: unit.sounds
          .filter((x) => x.i >= first && x.i < end)
          .map((x) => ({ ...x, i: x.i - first })),
      };
    });
  });
}

/** Whether anyone marked the phrase (accents, group ends, linkings): the «Melody» lens means nothing without. */
export function hasPhraseMarks(layers: Iterable<ProsodyLayer>): boolean {
  for (const l of layers) {
    if (l.accents.length > 0 || l.boundaries.length > 0 || l.links.length > 0) return true;
  }
  return false;
}

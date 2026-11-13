import {
  elementsOf,
  layerOf,
  type ProsodyElement,
  type ProsodyLayer,
} from '@/lib/shared-kernel/prosody';
import type { Sentence } from '@/lib/shared-kernel/text/sentences';

// The ✦ suggestion of phrase marks (plan 86, step 6h.3c), taken one sentence at a time. The
// agent sets only phrase marks — the main word, group ends, linkings — and never word stress,
// so accepting it in a sentence replaces the phrase marks there and nothing else. Accepted
// marks keep the `ai` source until the author touches them (`layer-edits.ts`).

const PHRASE: ReadonlySet<ProsodyElement['kind']> = new Set(['accent', 'boundary', 'link']);

const inSentence = (el: ProsodyElement, s: Sentence) =>
  PHRASE.has(el.kind) && el.mark.i >= s.first && el.mark.i < s.end;

/** The phrase marks of the sentence, as `kind:i:value` keys — sources aside. */
function phraseKeys(layer: ProsodyLayer, s: Sentence): string[] {
  return elementsOf(layer)
    .filter((el) => inSentence(el, s))
    .map((el) =>
      el.kind === 'boundary'
        ? `boundary:${el.mark.i}:${el.mark.pitch}:${el.mark.pause}`
        : `${el.kind}:${el.mark.i}`,
    )
    .sort();
}

/** Whether accepting the suggestion in the sentence would change anything. */
export function differsIn(layer: ProsodyLayer, suggested: ProsodyLayer, s: Sentence): boolean {
  const a = phraseKeys(layer, s);
  const b = phraseKeys(suggested, s);
  return a.length !== b.length || a.some((key, k) => key !== b[k]);
}

/** The layer with the sentence's phrase marks replaced by the suggestion's. */
export function acceptIn(layer: ProsodyLayer, suggested: ProsodyLayer, s: Sentence): ProsodyLayer {
  const kept = elementsOf(layer).filter((el) => !inSentence(el, s));
  const taken = elementsOf(suggested)
    .filter((el) => inSentence(el, s))
    .map((el) => ({ ...el, mark: { ...el.mark, source: 'ai' } }) as ProsodyElement);
  return layerOf([...kept, ...taken], layer.orphans);
}

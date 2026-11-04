import {
  elementsOf,
  layerOf,
  stressedVowelFrom,
  type GroupBoundary,
  type GroupPause,
  type GroupPitch,
  type ProsodyElement,
  type ProsodyKind,
  type ProsodyLayer,
  type StressedVowel,
  type Toneme,
  type WordStress,
} from '@/lib/shared-kernel/prosody';
import type { Token } from '@/lib/shared-kernel/text/words';

// What the «Pronunciation» editor does to an authored layer (plan 86, §4i.4), one word at a time.
// Pure: every edit returns a new layer anchored to the same text, orphans kept. A mark an edit
// touches becomes the teacher's — an accepted AI mark stays `ai` only until someone changes it.
// Lexicon words are never written here: «back to the dictionary» removes the author's answer.

const anchor = (token: Token) => ({ i: token.i, w: token.w });

/** The layer without the elements of these kinds on the token. */
function without(
  layer: ProsodyLayer,
  token: Token,
  kinds: readonly ProsodyKind[],
): ProsodyElement[] {
  return elementsOf(layer).filter((el) => !(el.mark.i === token.i && kinds.includes(el.kind)));
}

export function accentOn(layer: ProsodyLayer, token: Token): boolean {
  return layer.accents.some((a) => a.i === token.i);
}

export function boundaryOn(layer: ProsodyLayer, token: Token): GroupBoundary | undefined {
  return layer.boundaries.find((b) => b.i === token.i);
}

export function setAccent(layer: ProsodyLayer, token: Token, on: boolean): ProsodyLayer {
  const rest = without(layer, token, ['accent']);
  if (on) rest.push({ kind: 'accent', mark: { ...anchor(token), source: 'teacher' } });
  return layerOf(rest, layer.orphans);
}

/**
 * The group end after the word. A field left out keeps its value; with neither a pitch nor a
 * pause the word is not an end any more.
 */
export function setBoundary(
  layer: ProsodyLayer,
  token: Token,
  change: { pitch?: GroupPitch | null; pause?: GroupPause | null },
): ProsodyLayer {
  const current = boundaryOn(layer, token);
  const pitch = change.pitch !== undefined ? change.pitch : (current?.pitch ?? null);
  const pause = change.pause !== undefined ? change.pause : (current?.pause ?? null);
  const rest = without(layer, token, ['boundary']);
  if (pitch !== null || pause !== null) {
    rest.push({ kind: 'boundary', mark: { ...anchor(token), pitch, pause, source: 'teacher' } });
  }
  return layerOf(rest, layer.orphans);
}

/** A click on the gap after the word: no pause → | → ‖ → no pause, the pitch kept. */
export function cyclePause(layer: ProsodyLayer, token: Token): ProsodyLayer {
  const pause = boundaryOn(layer, token)?.pause ?? null;
  const next: GroupPause | null = pause === null ? 'short' : pause === 'short' ? 'long' : null;
  return setBoundary(layer, token, { pause: next });
}

/** `Del` on a word: its phrase marks go, its stress stays. */
export function clearPhrase(layer: ProsodyLayer, token: Token): ProsodyLayer {
  return layerOf(without(layer, token, ['accent', 'boundary', 'link']), layer.orphans);
}

/** The author's stress on the word, replacing the dictionary's and any «no stress». */
export function setStress(
  layer: ProsodyLayer,
  token: Token,
  vowel: StressedVowel,
  toneme: Toneme | null,
): ProsodyLayer {
  const rest = without(layer, token, ['stress', 'unstressed']);
  rest.push({ kind: 'stress', mark: { ...anchor(token), vowel, toneme, source: 'teacher' } });
  return layerOf(rest, layer.orphans);
}

/** «No stress»: a name the dictionary does not know, or a function word it stressed. */
export function setUnstressed(layer: ProsodyLayer, token: Token): ProsodyLayer {
  const rest = without(layer, token, ['stress', 'unstressed']);
  rest.push({ kind: 'unstressed', mark: { ...anchor(token), source: 'teacher' } });
  return layerOf(rest, layer.orphans);
}

/** «Back to the dictionary»: the author's answer about the word's stress is dropped. */
export function revertWord(layer: ProsodyLayer, token: Token): ProsodyLayer {
  return layerOf(without(layer, token, ['stress', 'unstressed']), layer.orphans);
}

/** Whether the author answered for the word's stress — a stress of their own or «no stress». */
export function wordAnswered(layer: ProsodyLayer, token: Token): 'stress' | 'unstressed' | null {
  if (layer.stresses.some((s) => s.i === token.i)) return 'stress';
  if ((layer.unstressed ?? []).some((u) => u.i === token.i)) return 'unstressed';
  return null;
}

/**
 * The vowel nuclei of a word in order — the choices for its stressed vowel. A diphthong is one
 * nucleus (`øy`), as the spelling fallback of the kernel reads it.
 */
export function vowelNuclei(word: string): StressedVowel[] {
  const out: StressedVowel[] = [];
  let from = 0;
  for (;;) {
    const v = stressedVowelFrom(word, from);
    if (v === null) return out;
    out.push(v);
    from = v.e;
  }
}

/**
 * The stress the author's pick of a vowel means. The length comes from the dictionary when it
 * stresses the same vowel; the toneme is kept from what the word showed, else tone 1 for a word
 * of several syllables and none for a monosyllable (§4a: a monosyllable carries no toneme).
 */
export function stressFor(
  word: string,
  vowel: StressedVowel,
  shown: WordStress | undefined,
  lexicon: WordStress | undefined,
): { vowel: StressedVowel; toneme: Toneme | null } {
  const sameAsLexicon = lexicon && lexicon.vowel.s === vowel.s && lexicon.vowel.e === vowel.e;
  const long = sameAsLexicon ? lexicon.vowel.long : null;
  const several = vowelNuclei(word).length > 1;
  const toneme = several ? (shown?.toneme ?? 1) : null;
  return { vowel: { s: vowel.s, e: vowel.e, long }, toneme };
}

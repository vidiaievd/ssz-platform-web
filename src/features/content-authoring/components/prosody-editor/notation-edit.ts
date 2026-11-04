import {
  checkProsodyNotation,
  elementsOf,
  layerOf,
  toProsodyNotation,
  type NotationIssue,
  type ProsodyElement,
  type ProsodyLayer,
} from '@/lib/shared-kernel/prosody';

// The «As text» view of the editor (plan 86, step 6h.3c): the authored layer written in the
// notation of §4a (`'1 '2 ' '0 ^ \ / ~ | || _`), and read back after the author typed in it.
// Only the author's marks are written — the dictionary's stresses are not the author's and
// would come back as theirs. Pure, like `layer-edits.ts`.

export interface WrittenLayer {
  notation: string;
  /**
   * Marks the notation has no room for (a group end after a word glued to the next one,
   * `ord.Neste`). Reading the notation back keeps them as they are.
   */
  kept: ProsodyElement[];
}

export function writeLayer(text: string, layer: ProsodyLayer): WrittenLayer {
  const { notation, dropped } = toProsodyNotation(text, layer);
  const kept =
    dropped === 0
      ? []
      : elementsOf(layer).filter((el) => toProsodyNotation(text, layerOf([el])).dropped > 0);
  return { notation, kept };
}

export type ReadNotation =
  | { status: 'ok'; layer: ProsodyLayer }
  | { status: 'invalid'; issues: NotationIssue[] };

/**
 * The notation the author typed, as a layer over `text`. A mark that is what it was keeps its
 * element — its source (an accepted `ai` mark stays `ai`) and its vowel length, which the
 * notation does not carry; anything else typed is the teacher's. Orphans and the marks the
 * notation could not write are carried over.
 */
export function readNotation(text: string, notation: string, current: ProsodyLayer): ReadNotation {
  const parsed = checkProsodyNotation(text, notation, 'teacher');
  if (parsed.issues.length > 0) return { status: 'invalid', issues: parsed.issues };

  const before = elementsOf(current);
  const elements = elementsOf(parsed.layer).map((el) => {
    const same = before.find((old) => sameMark(old, el));
    if (same) return same;
    if (el.kind === 'stress') {
      // The same vowel with another toneme: the length the dictionary or the card gave stays.
      const vowel = before.find(
        (old) =>
          old.kind === 'stress' &&
          old.mark.i === el.mark.i &&
          old.mark.vowel.s === el.mark.vowel.s &&
          old.mark.vowel.e === el.mark.vowel.e,
      );
      if (vowel?.kind === 'stress') {
        return {
          ...el,
          mark: { ...el.mark, vowel: { ...el.mark.vowel, long: vowel.mark.vowel.long } },
        };
      }
    }
    return el;
  });
  for (const el of writeLayer(text, current).kept) {
    if (!elements.some((x) => x.kind === el.kind && x.mark.i === el.mark.i)) elements.push(el);
  }
  return { status: 'ok', layer: layerOf(elements, current.orphans) };
}

/** Where an issue points in the notation — `null` for a text that parted from the passage. */
export function issueOffset(issue: NotationIssue): number | null {
  return 'at' in issue ? issue.at : null;
}

/** 1-based line and column of an offset, as the author counts in the field. */
export function lineAndColumn(source: string, at: number): { line: number; column: number } {
  const before = source.slice(0, at);
  const lineStart = before.lastIndexOf('\n') + 1;
  return { line: before.split('\n').length, column: at - lineStart + 1 };
}

function sameMark(a: ProsodyElement, b: ProsodyElement): boolean {
  if (a.kind !== b.kind || a.mark.i !== b.mark.i) return false;
  if (a.kind === 'stress' && b.kind === 'stress') {
    return (
      a.mark.toneme === b.mark.toneme &&
      a.mark.vowel.s === b.mark.vowel.s &&
      a.mark.vowel.e === b.mark.vowel.e
    );
  }
  if (a.kind === 'boundary' && b.kind === 'boundary') {
    return a.mark.pitch === b.mark.pitch && a.mark.pause === b.mark.pause;
  }
  return true;
}

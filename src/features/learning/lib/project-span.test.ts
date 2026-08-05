import { describe, expect, it } from 'vitest';

import { parseInlineMarkdown } from './parse-inline-markdown';
import { collectMappedTexts, parseMarkdownBlocks } from './parse-markdown-blocks';
import { projectRange, projectSpansOntoBlocks, usesAuthoredVocabulary } from './project-span';

/** A span is identified by the paragraph-source text the author selected. */
function spanOver(paragraph: string, selection: string) {
  const charStart = paragraph.indexOf(selection);
  if (charStart < 0) throw new Error(`fixture does not contain ${JSON.stringify(selection)}`);
  return { id: selection, charStart, charEnd: charStart + selection.length };
}

/** What the reader would actually underline, once both parsers have run. */
function renderedTexts(paragraph: string, selections: string[]): string[] {
  const blocks = parseMarkdownBlocks(paragraph);
  const placed = projectSpansOntoBlocks(
    blocks,
    selections.map((selection) => spanOver(paragraph, selection)),
  );

  const out: string[] = [];
  for (const node of collectMappedTexts(blocks)) {
    const inline = parseInlineMarkdown(node.text);
    for (const projected of placed.get(node) ?? []) {
      // Second hop: block text -> the emphasis-stripped string GlossaryText renders.
      const hit = projectRange(inline.sourceIndexOf, projected.start, projected.end);
      if (hit) out.push(inline.text.slice(hit.start, hit.end));
    }
  }
  return out;
}

describe('projectRange', () => {
  it('returns null for a range that reaches no output character', () => {
    const { sourceIndexOf } = parseInlineMarkdown('Han er **veldig** ivrig.');
    // Exactly the opening `**` — markup only, so there is nothing to annotate.
    expect(projectRange(sourceIndexOf, 7, 9)).toBeNull();
  });

  it('returns null for an empty or inverted range', () => {
    const { sourceIndexOf } = parseInlineMarkdown('Han er ivrig.');
    expect(projectRange(sourceIndexOf, 4, 4)).toBeNull();
    expect(projectRange(sourceIndexOf, 6, 3)).toBeNull();
  });

  it('never projects onto the map’s exclusive-end entry', () => {
    const raw = 'Han er ivrig.';
    const { text, sourceIndexOf } = parseInlineMarkdown(raw);
    // A range starting past the last character has no output to land on, even
    // though the trailing map entry equals raw.length.
    expect(projectRange(sourceIndexOf, raw.length, raw.length + 5)).toBeNull();
    expect(projectRange(sourceIndexOf, 0, raw.length)).toEqual({ start: 0, end: text.length });
  });
});

describe('projectSpansOntoBlocks', () => {
  it('places a span on the paragraph that renders it', () => {
    const paragraph = 'Bartek har jobbet som elektriker i det samme firmaet.';
    expect(renderedTexts(paragraph, ['som elektriker'])).toEqual(['som elektriker']);
  });

  it('strips emphasis delimiters out of what gets highlighted', () => {
    const paragraph = 'Vi tilbyr **et godt arbeidsmiljø** til alle.';
    // The author selected the emphasised phrase including its asterisks.
    expect(renderedTexts(paragraph, ['**et godt arbeidsmiljø**'])).toEqual(['et godt arbeidsmiljø']);
  });

  it('follows a span across a soft line break', () => {
    const paragraph = 'Han bor i Oslo. Han\ntrives med kollegaene.';
    expect(renderedTexts(paragraph, ['Han\ntrives'])).toEqual(['Han trives']);
  });

  it('drops a span covering only markup', () => {
    const paragraph = 'Han er **veldig** ivrig.';
    expect(renderedTexts(paragraph, ['**'])).toEqual([]);
  });

  it('places a span inside a list item on that item alone', () => {
    const paragraph = 'Vi ønsker at du:\n- har fagbrev som elektriker\n- har tre års erfaring';
    expect(renderedTexts(paragraph, ['fagbrev'])).toEqual(['fagbrev']);
  });

  // Spec 16 §8 obligation 11.
  it('drops a span crossing a list-item boundary and throws nothing', () => {
    const paragraph = 'Vi ønsker at du:\n- har fagbrev som elektriker\n- har tre års erfaring';
    const selection = 'elektriker\n- har';
    expect(() => renderedTexts(paragraph, [selection])).not.toThrow();
    expect(renderedTexts(paragraph, [selection])).toEqual([]);
  });

  it('drops a span crossing from a paragraph into the list below it', () => {
    const paragraph = 'Vi ønsker at du:\n- har fagbrev';
    expect(renderedTexts(paragraph, ['du:\n- har'])).toEqual([]);
  });

  it('places a span nested in a blockquote onto the right inner block', () => {
    const paragraph = ['> **Erfaren elektriker søkes**', '>', '> Vi trenger en nøyaktig elektriker.'].join(
      '\n',
    );
    // Two occurrences of the word; the second one is the annotated occurrence.
    expect(renderedTexts(paragraph, ['nøyaktig elektriker'])).toEqual(['nøyaktig elektriker']);
  });

  it('keeps a paragraph’s spans sorted by position', () => {
    const paragraph = 'Bartek har jobbet som elektriker i tre år.';
    const blocks = parseMarkdownBlocks(paragraph);
    const placed = projectSpansOntoBlocks(blocks, [
      spanOver(paragraph, 'tre år'),
      spanOver(paragraph, 'Bartek'),
      spanOver(paragraph, 'jobbet'),
    ]);
    const [node] = collectMappedTexts(blocks);
    expect(placed.get(node!)?.map((p) => p.span.id)).toEqual(['Bartek', 'jobbet', 'tre år']);
  });

  it('annotates one occurrence without touching the other', () => {
    const paragraph = 'Elektrikeren kom. En annen elektriker kom senere.';
    const second = paragraph.lastIndexOf('elektriker');
    const blocks = parseMarkdownBlocks(paragraph);
    const placed = projectSpansOntoBlocks(blocks, [
      { id: 'second', charStart: second, charEnd: second + 'elektriker'.length },
    ]);
    const [node] = collectMappedTexts(blocks);
    const projected = placed.get(node!)![0]!;
    expect(node!.text.slice(projected.start, projected.end)).toBe('elektriker');
    expect(projected.start).toBe(second);
  });
});

describe('usesAuthoredVocabulary', () => {
  it('is true when the variant has a live vocab span', () => {
    expect(usesAuthoredVocabulary([{ kind: 'vocab' }])).toBe(true);
  });

  it('is false for a variant with no spans at all', () => {
    expect(usesAuthoredVocabulary([])).toBe(false);
  });

  it('is false when only grammar and chunk spans exist', () => {
    // Those have no tokenizer counterpart, so lexis keeps its fallback.
    expect(usesAuthoredVocabulary([{ kind: 'grammar' }, { kind: 'chunk' }])).toBe(false);
  });

  it('ignores a broken vocab span', () => {
    expect(usesAuthoredVocabulary([{ kind: 'vocab', broken: true }])).toBe(false);
    expect(usesAuthoredVocabulary([{ kind: 'vocab', broken: true }, { kind: 'vocab' }])).toBe(true);
  });
});

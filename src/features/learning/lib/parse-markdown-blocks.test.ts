import { describe, expect, it } from 'vitest';

import { parseMarkdownBlocks } from './parse-markdown-blocks';

describe('parseMarkdownBlocks', () => {
  it('joins a soft-wrapped paragraph into one block', () => {
    const blocks = parseMarkdownBlocks(
      'Bartek har jobbet som elektriker i det samme firmaet i tre år. Han\ntrives med kollegaene.',
    );
    expect(blocks).toEqual([
      {
        kind: 'paragraph',
        text: 'Bartek har jobbet som elektriker i det samme firmaet i tre år. Han trives med kollegaene.',
      },
    ]);
  });

  it('parses the job-ad blockquote from lesson 1A', () => {
    const blocks = parseMarkdownBlocks(
      [
        '> **Erfaren elektriker søkes**',
        '>',
        '> Nordby Elektro AS er et voksende firma med tolv ansatte. Vi trenger en',
        '> selvstendig og nøyaktig elektriker.',
        '>',
        '> **Vi ønsker at du:**',
        '> - har fagbrev som elektriker',
        '> - har minst tre års erfaring',
        '>',
        '> Søknad med CV sendes til post@nordbyelektro.no innen 15. mars.',
      ].join('\n'),
    );

    expect(blocks).toEqual([
      {
        kind: 'quote',
        blocks: [
          { kind: 'paragraph', text: '**Erfaren elektriker søkes**' },
          {
            kind: 'paragraph',
            text: 'Nordby Elektro AS er et voksende firma med tolv ansatte. Vi trenger en selvstendig og nøyaktig elektriker.',
          },
          { kind: 'paragraph', text: '**Vi ønsker at du:**' },
          { kind: 'list', items: ['har fagbrev som elektriker', 'har minst tre års erfaring'] },
          {
            kind: 'paragraph',
            text: 'Søknad med CV sendes til post@nordbyelektro.no innen 15. mars.',
          },
        ],
      },
    ]);
  });

  it('parses headings with their level', () => {
    expect(parseMarkdownBlocks('## Forstå teksten')).toEqual([
      { kind: 'heading', level: 2, text: 'Forstå teksten' },
    ]);
    expect(parseMarkdownBlocks('# 18C — Planer for påsken')).toEqual([
      { kind: 'heading', level: 1, text: '18C — Planer for påsken' },
    ]);
  });

  it('does not read a date or an ordinal as an ordered list', () => {
    expect(parseMarkdownBlocks('17. mai er Norges nasjonaldag.')).toEqual([
      { kind: 'paragraph', text: '17. mai er Norges nasjonaldag.' },
    ]);
    expect(parseMarkdownBlocks('1. april.')).toEqual([{ kind: 'paragraph', text: '1. april.' }]);
  });

  it('ends a paragraph where a list begins', () => {
    expect(parseMarkdownBlocks('Vi ønsker at du:\n- har fagbrev\n- har erfaring')).toEqual([
      { kind: 'paragraph', text: 'Vi ønsker at du:' },
      { kind: 'list', items: ['har fagbrev', 'har erfaring'] },
    ]);
  });

  it('keeps inline markup for the inline parser', () => {
    expect(parseMarkdownBlocks('Han er **veldig** ivrig.')).toEqual([
      { kind: 'paragraph', text: 'Han er **veldig** ivrig.' },
    ]);
  });

  it('returns nothing for blank input', () => {
    expect(parseMarkdownBlocks('')).toEqual([]);
    expect(parseMarkdownBlocks('   \n\n  ')).toEqual([]);
  });

  it('separates paragraphs split by a blank line inside the chunk', () => {
    expect(parseMarkdownBlocks('Første.\n\nAndre.')).toEqual([
      { kind: 'paragraph', text: 'Første.' },
      { kind: 'paragraph', text: 'Andre.' },
    ]);
  });
});

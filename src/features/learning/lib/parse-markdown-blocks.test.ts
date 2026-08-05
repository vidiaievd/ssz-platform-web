import { describe, expect, it } from 'vitest';

import { expectValidSourceMap } from '@/test/source-map';

import { collectMappedTexts, parseMarkdownBlocks, type MarkdownBlock } from './parse-markdown-blocks';

/**
 * Structure assertions below compare whole blocks. Each one also carries a
 * `sourceIndexOf` map — checked as a property in its own suite, and far too
 * noisy to spell out per fixture — so it is stripped here.
 */
function structure(chunk: string): unknown[] {
  const strip = (blocks: MarkdownBlock[]): unknown[] =>
    blocks.map((block) => {
      switch (block.kind) {
        case 'list':
          return { kind: 'list', items: block.items.map((item) => item.text) };
        case 'quote':
          return { kind: 'quote', blocks: strip(block.blocks) };
        case 'heading':
          return { kind: 'heading', level: block.level, text: block.text };
        case 'table':
          return {
            kind: 'table',
            head: block.head.map((cell) => cell.text),
            rows: block.rows.map((row) => row.map((cell) => cell.text)),
          };
        default:
          return { kind: 'paragraph', text: block.text };
      }
    });
  return strip(parseMarkdownBlocks(chunk));
}

describe('parseMarkdownBlocks', () => {
  it('joins a soft-wrapped paragraph into one block', () => {
    const blocks = structure(
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
    const blocks = structure(
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
    expect(structure('## Forstå teksten')).toEqual([
      { kind: 'heading', level: 2, text: 'Forstå teksten' },
    ]);
    expect(structure('# 18C — Planer for påsken')).toEqual([
      { kind: 'heading', level: 1, text: '18C — Planer for påsken' },
    ]);
  });

  it('does not read a date or an ordinal as an ordered list', () => {
    expect(structure('17. mai er Norges nasjonaldag.')).toEqual([
      { kind: 'paragraph', text: '17. mai er Norges nasjonaldag.' },
    ]);
    expect(structure('1. april.')).toEqual([{ kind: 'paragraph', text: '1. april.' }]);
  });

  it('ends a paragraph where a list begins', () => {
    expect(structure('Vi ønsker at du:\n- har fagbrev\n- har erfaring')).toEqual([
      { kind: 'paragraph', text: 'Vi ønsker at du:' },
      { kind: 'list', items: ['har fagbrev', 'har erfaring'] },
    ]);
  });

  it('keeps inline markup for the inline parser', () => {
    expect(structure('Han er **veldig** ivrig.')).toEqual([
      { kind: 'paragraph', text: 'Han er **veldig** ivrig.' },
    ]);
  });

  it('returns nothing for blank input', () => {
    expect(structure('')).toEqual([]);
    expect(structure('   \n\n  ')).toEqual([]);
  });

  it('separates paragraphs split by a blank line inside the chunk', () => {
    expect(structure('Første.\n\nAndre.')).toEqual([
      { kind: 'paragraph', text: 'Første.' },
      { kind: 'paragraph', text: 'Andre.' },
    ]);
  });

  // Authored grammar explanations lean on paradigm tables; printing their
  // source would put `|---|` in front of the reader.
  it('reads a pipe table as a table', () => {
    const blocks = structure(
      ['| Modalverb | Betydning |', '|---|---|', '| kan | ability |', '| må | necessity |'].join('\n'),
    );
    expect(blocks).toEqual([
      {
        kind: 'table',
        head: ['Modalverb', 'Betydning'],
        rows: [
          ['kan', 'ability'],
          ['må', 'necessity'],
        ],
      },
    ]);
  });

  it('keeps the header row out of the paragraph above it', () => {
    const blocks = structure(
      ['Modalverbene bøyes slik:', '| Infinitiv | Presens |', '| --- | --- |', '| å kunne | kan |'].join(
        '\n',
      ),
    );
    expect(blocks).toEqual([
      { kind: 'paragraph', text: 'Modalverbene bøyes slik:' },
      { kind: 'table', head: ['Infinitiv', 'Presens'], rows: [['å kunne', 'kan']] },
    ]);
  });

  it('leaves a pipe inside prose alone', () => {
    // Only the delimiter row makes a table; a sentence may well contain a pipe.
    expect(structure('Velg mellom kan | må | skal.')).toEqual([
      { kind: 'paragraph', text: 'Velg mellom kan | må | skal.' },
    ]);
  });

  it('reads a table written without outer pipes', () => {
    expect(structure(['a | b', '--- | ---', '1 | 2'].join('\n'))).toEqual([
      { kind: 'table', head: ['a', 'b'], rows: [['1', '2']] },
    ]);
  });
});

const JOB_AD = [
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
].join('\n');

describe('parseMarkdownBlocks source map', () => {
  // The structural fixtures this suite already exercises, reused as the
  // property test's corpus per spec 16 §8 obligation 10.
  const FIXTURES = [
    'Bartek har jobbet som elektriker i det samme firmaet i tre år. Han\ntrives med kollegaene.',
    JOB_AD,
    '## Forstå teksten',
    '# 18C — Planer for påsken',
    '17. mai er Norges nasjonaldag.',
    'Vi ønsker at du:\n- har fagbrev\n- har erfaring',
    'Han er **veldig** ivrig.',
    'Første.\n\nAndre.',
    '   ###   Mye  luft   ',
    '>   dobbelt innrykk\n>og ingen',
  ];

  it.each(FIXTURES)('maps every output character back into %j', (chunk) => {
    for (const mapped of collectMappedTexts(parseMarkdownBlocks(chunk))) {
      expectValidSourceMap(chunk, mapped);
    }
  });

  it('skips the heading marker', () => {
    const chunk = '## Forstå teksten';
    const [block] = parseMarkdownBlocks(chunk);
    if (block?.kind !== 'heading') throw new Error('expected a heading');
    expect(chunk.slice(block.sourceIndexOf[0]!, block.sourceIndexOf[block.text.length]!)).toBe(
      'Forstå teksten',
    );
  });

  it('skips the bullet marker of each list item', () => {
    const chunk = 'Vi ønsker at du:\n- har fagbrev\n- har erfaring';
    const [, list] = parseMarkdownBlocks(chunk);
    if (list?.kind !== 'list') throw new Error('expected a list');
    const spans = list.items.map((item) =>
      chunk.slice(item.sourceIndexOf[0]!, item.sourceIndexOf[item.text.length]!),
    );
    expect(spans).toEqual(['har fagbrev', 'har erfaring']);
  });

  it('projects a soft-wrapped paragraph across the line break', () => {
    const chunk = 'Bartek har jobbet som elektriker i det samme firmaet i tre år. Han\ntrives med kollegaene.';
    const [block] = parseMarkdownBlocks(chunk);
    if (block?.kind !== 'paragraph') throw new Error('expected a paragraph');

    // A span selected in the raw body across the wrap must still land on the
    // same words once the lines are joined with a space.
    const start = block.text.indexOf('Han trives');
    const end = start + 'Han trives'.length;
    expect(chunk.slice(block.sourceIndexOf[start]!, block.sourceIndexOf[end]!)).toBe('Han\ntrives');
  });

  it('rebases blocks nested in a quote onto the original chunk', () => {
    const [quote] = parseMarkdownBlocks(JOB_AD);
    if (quote?.kind !== 'quote') throw new Error('expected a quote');

    // The inner parse ran on the chunk with every `> ` stripped; without the
    // rebase these offsets would index that intermediate string instead.
    for (const mapped of collectMappedTexts(quote.blocks)) {
      expectValidSourceMap(JOB_AD, mapped);
    }

    const list = quote.blocks.find((block) => block.kind === 'list');
    if (list?.kind !== 'list') throw new Error('expected a list inside the quote');
    const first = list.items[0]!;
    expect(JOB_AD.slice(first.sourceIndexOf[0]!, first.sourceIndexOf[first.text.length]!)).toBe(
      'har fagbrev som elektriker',
    );
  });

  it('maps a table cell back onto the chunk it came from', () => {
    const chunk = ['| Infinitiv | Presens |', '|---|---|', '| å kunne | kan |'].join('\n');
    const blocks = parseMarkdownBlocks(chunk);
    for (const mapped of collectMappedTexts(blocks)) {
      expectValidSourceMap(chunk, mapped);
    }

    const table = blocks[0];
    if (table?.kind !== 'table') throw new Error('expected a table');
    const cell = table.rows[0]![0]!;
    expect(chunk.slice(cell.sourceIndexOf[0]!, cell.sourceIndexOf[cell.text.length]!)).toBe('å kunne');
  });
});

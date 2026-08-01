import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { WordParadigmTable } from './word-paradigm-table';

const meta = {
  title: 'Learning/WordParadigmTable',
  component: WordParadigmTable,
  parameters: { layout: 'centered' },
  // The rail this table lives in, so the stories show its real constraints.
  decorators: [
    (Story) => (
      <div style={{ width: 320 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof WordParadigmTable>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Number against definiteness, with the article derived from the gender. */
export const Noun: Story = {
  args: {
    paradigm: {
      kind: 'noun',
      gender: 'masculine',
      indefiniteSingular: 'bil',
      definiteSingular: 'bilen',
      indefinitePlural: 'biler',
      definitePlural: 'bilene',
    },
  },
};

/** Feminine nouns take "ei", neuter "et". */
export const FeminineNoun: Story = {
  args: {
    paradigm: {
      kind: 'noun',
      gender: 'feminine',
      indefiniteSingular: 'veske',
      definiteSingular: 'veska',
      indefinitePlural: 'vesker',
      definitePlural: 'veskene',
    },
  },
};

/**
 * The case the matrix cannot hold: a compound in every cell. Falls back to one
 * form per row, which fits the rail at any width.
 */
export const LongCompound: Story = {
  args: {
    paradigm: {
      kind: 'noun',
      gender: 'masculine',
      indefiniteSingular: 'stillingsannonse',
      definiteSingular: 'stillingsannonsen',
      indefinitePlural: 'stillingsannonser',
      definitePlural: 'stillingsannonsene',
    },
    highlightValue: 'stillingsannonser',
  },
};

/** A noun with no plural — the cell stays, so the axes stay square. */
export const NounMissingCell: Story = {
  args: {
    paradigm: {
      kind: 'noun',
      gender: 'neuter',
      indefiniteSingular: 'hus',
      definiteSingular: 'huset',
      definitePlural: 'husene',
    },
  },
};

/** Tenses in sequence, with the "å" and "har" particles muted. */
export const Verb: Story = {
  args: {
    paradigm: {
      kind: 'verb',
      infinitive: 'søke',
      present: 'søker',
      past: 'søkte',
      perfect: 'søkt',
    },
    highlightValue: 'søker',
  },
};

/** A strong verb: the shared stem is short, so little gets marked. */
export const StrongVerb: Story = {
  args: {
    paradigm: {
      kind: 'verb',
      verbClass: 'strong',
      infinitive: 'skrive',
      present: 'skriver',
      past: 'skrev',
      perfect: 'skrevet',
    },
  },
};

/** Degrees, with the periphrastic ones left unmarked — they share no stem. */
export const Adjective: Story = {
  args: {
    paradigm: {
      kind: 'adjective',
      positive: 'erfaren',
      neuter: 'erfarent',
      plural: 'erfarne',
      comparative: 'mer erfaren',
      superlative: 'mest erfaren',
    },
  },
};

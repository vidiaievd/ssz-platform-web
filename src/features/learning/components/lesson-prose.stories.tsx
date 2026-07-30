import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import type { LessonSpanKind, LessonTextSpan, VocabularyItem } from '@/features/content/types';

import { LessonProse } from './lesson-prose';
import { buildGlossaryIndex } from '../lib/tokenize-glossary';

const meta = {
  title: 'Learning/LessonProse',
  component: LessonProse,
  decorators: [
    (Story) => (
      <div className="mx-auto max-w-[46rem] p-10 text-[19px] leading-[1.9]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof LessonProse>;

export default meta;
type Story = StoryObj<typeof meta>;

const ITEMS: VocabularyItem[] = [
  {
    id: 'v-fagbrev',
    lemma: 'fagbrev',
    partOfSpeech: 'noun',
    translations: [{ languageCode: 'en', translation: 'trade certificate' }],
    examples: [],
  },
  {
    id: 'v-erfaring',
    lemma: 'erfaring',
    partOfSpeech: 'noun',
    forms: [{ label: 'Ubestemt flertall', value: 'erfaringer' }],
    translations: [{ languageCode: 'en', translation: 'experience' }],
    examples: [],
  },
];

const glossary = buildGlossaryIndex(ITEMS);

const TEXT = [
  'Bartek har fagbrev som elektriker og lang erfaring fra Polen. I det siste',
  'har han tenkt på å bytte jobb, fordi han vil ha mer ansvar.',
].join('\n');

function span(selection: string, kind: LessonSpanKind, refId: string | null = null): LessonTextSpan {
  const charStart = TEXT.indexOf(selection);
  return {
    id: `${kind}-${charStart}`,
    paragraphIndex: 0,
    charStart,
    charEnd: charStart + selection.length,
    kind,
    refId,
    textSnapshot: selection,
    note: kind === 'chunk' ? 'Fast uttrykk: «nylig», «den siste tiden».' : null,
    broken: false,
    brokenReason: null,
    reanchorCandidates: [],
  };
}

/** No spans authored: the A1 tokenizer marks every occurrence it can match. */
export const TokenizerFallback: Story = {
  args: { text: TEXT, glossary, lang: 'nb' },
};

/**
 * The three kinds together. Hue carries the kind — lexis keeps the teal
 * underline, grammar the warm fill, a chunk the violet backdrop — while the
 * underline's weight still carries how well the reader knows the word.
 */
export const AllThreeKinds: Story = {
  args: {
    text: TEXT,
    glossary,
    lang: 'nb',
    authoredVocabulary: true,
    spans: [
      span('fagbrev', 'vocab', 'v-fagbrev'),
      span('I det siste\nhar han tenkt', 'chunk'),
      span('har han tenkt på', 'grammar', 'g-perfektum'),
    ],
  },
};

/**
 * A chunk and a grammar span that only partly overlap. Spec 16 §3.2 allows it
 * and promises a visual seam rather than lost text: the grammar fill is cut at
 * the chunk's edge and continues after it.
 */
export const PartialOverlapSeam: Story = {
  args: {
    text: TEXT,
    glossary,
    lang: 'nb',
    spans: [span('I det siste', 'chunk'), span('siste\nhar han tenkt', 'grammar', 'g-perfektum')],
  },
};

/** Glossing turned off: backdrops go, the lexis lookup stays reachable. */
export const GlossingOff: Story = {
  args: {
    ...AllThreeKinds.args,
    spansHidden: true,
  },
};

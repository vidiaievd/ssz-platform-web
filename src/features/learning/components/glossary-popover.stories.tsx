import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { GlossaryPopover } from './glossary-popover';

const meta = {
  title: 'Learning/GlossaryPopover',
  component: GlossaryPopover,
  decorators: [(Story) => <div className="flex items-start justify-center p-20"><Story /></div>],
} satisfies Meta<typeof GlossaryPopover>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Noun: Story = {
  args: {
    word: 'sykepleier',
    phonetic: '/ˈsyːkəˌplɛɪər/',
    pos: 'noun',
    translation: 'nurse',
    children: (
      <button className="rounded bg-[var(--ssz-color-primary-50)] px-1 font-reading text-sm font-semibold text-[var(--ssz-color-primary-700)] underline decoration-dotted">
        sykepleier
      </button>
    ),
  },
};

export const Verb: Story = {
  args: {
    word: 'slappe av',
    phonetic: '/ˈslɑpːə ɑːv/',
    pos: 'verb',
    translation: 'to relax',
    children: (
      <button className="rounded bg-[var(--ssz-color-success-50)] px-1 font-reading text-sm font-semibold text-[var(--ssz-color-success-700)] underline decoration-dotted">
        slappe av
      </button>
    ),
  },
};

export const WithContextLink: Story = {
  args: {
    word: 'arbeidsdag',
    phonetic: '/ˈɑːrbɛɪdsˌdɑːg/',
    pos: 'noun',
    translation: 'working day',
    onSeeInContext: () => alert('See in context'),
    children: (
      <button className="rounded bg-[var(--ssz-color-primary-50)] px-1 font-reading text-sm font-semibold text-[var(--ssz-color-primary-700)] underline decoration-dotted">
        arbeidsdag
      </button>
    ),
  },
};

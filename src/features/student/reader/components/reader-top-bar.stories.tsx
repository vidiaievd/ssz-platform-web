import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { ReaderTopBar } from './reader-top-bar';

const meta = {
  title: 'Student/Reader/ReaderTopBar',
  component: ReaderTopBar,
  decorators: [(Story) => <div className="w-full max-w-3xl"><Story /></div>],
} satisfies Meta<typeof ReaderTopBar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const TextLesson: Story = {
  args: {
    courseHref: '/student/courses/course-1',
    unitPosition: 4,
    levelTitle: 'Leksjon 1 — Arbeidsliv',
    unitTitle: '1A — Bartek søker ny jobb',
    itemKind: 'text',
    itemTitle: 'En vanlig arbeidsdag',
    avatarName: 'Alex Rivera',
  },
};

export const VocabLesson: Story = {
  args: {
    courseHref: '/student/courses/course-1',
    unitPosition: 1,
    itemKind: 'vocab',
    itemTitle: 'Yrker og oppgaver',
    avatarName: 'Alex Rivera',
  },
};

export const LongTitle: Story = {
  args: {
    courseHref: '/student/courses/course-1',
    unitPosition: 12,
    itemKind: 'video',
    itemTitle: 'A very long lesson title that should be truncated with an ellipsis in the breadcrumb',
    avatarName: 'Alex Rivera',
  },
};

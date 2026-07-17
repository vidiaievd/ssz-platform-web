import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { LessonFooterNav } from './lesson-footer-nav';
import type { ReaderSidebarItem } from '../types';

const items: ReaderSidebarItem[] = [
  { id: 'vocab-yrker', kind: 'vocab', title: 'Yrker og oppgaver', durationLabel: '7 min', status: 'completed', href: '/vocab-yrker' },
  { id: 'text-arbeidsdag', kind: 'text', title: 'En vanlig arbeidsdag', durationLabel: '8 min', status: 'in_progress', href: '/text-arbeidsdag' },
  { id: 'video-intervju', kind: 'video', title: 'Intervju på jobben', durationLabel: '6 min', status: 'available', href: '/video-intervju' },
  { id: 'ex-blandet', kind: 'exercise', title: 'Blandet øving', durationLabel: '12 min', status: 'locked', href: '/ex-blandet' },
];

const meta = {
  title: 'Student/Reader/LessonFooterNav',
  component: LessonFooterNav,
  decorators: [(Story) => <div className="w-full max-w-3xl"><Story /></div>],
} satisfies Meta<typeof LessonFooterNav>;

export default meta;
type Story = StoryObj<typeof meta>;

export const MiddleItem: Story = {
  args: { items, activeItemId: 'text-arbeidsdag' },
};

export const NextIsLocked: Story = {
  args: { items, activeItemId: 'video-intervju' },
};

export const FirstItem: Story = {
  args: { items, activeItemId: 'vocab-yrker' },
};

export const LastItem: Story = {
  args: { items, activeItemId: 'ex-blandet' },
};

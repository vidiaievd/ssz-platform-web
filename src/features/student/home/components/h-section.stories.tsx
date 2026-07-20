import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { BookOpen } from 'lucide-react';

import { HSection } from './h-section';
import { TextLink } from './text-link';

const meta = {
  title: 'Student/Home/HSection',
  component: HSection,
  decorators: [
    (Story) => (
      <div className="max-w-md">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof HSection>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Basic: Story = {
  args: { title: 'My courses' },
};

export const WithIconAndSub: Story = {
  args: { icon: BookOpen, title: 'My courses', sub: '4 in progress' },
};

export const WithAction: Story = {
  args: {
    icon: BookOpen,
    title: 'My courses',
    sub: '4 in progress',
    action: <TextLink>View all</TextLink>,
  },
};

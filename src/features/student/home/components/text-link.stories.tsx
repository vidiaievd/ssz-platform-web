import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { TextLink } from './text-link';

const meta = {
  title: 'Student/Home/TextLink',
  component: TextLink,
} satisfies Meta<typeof TextLink>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { children: 'View all' },
};

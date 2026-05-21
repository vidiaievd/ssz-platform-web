import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { Breadcrumbs } from './breadcrumbs';

const meta = {
  title: 'Shared/Breadcrumbs',
  component: Breadcrumbs,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof Breadcrumbs>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SingleItem: Story = {
  args: { items: [{ label: 'Dashboard' }] },
};

export const TwoLevels: Story = {
  args: {
    items: [
      { label: 'School', href: '/school/dashboard' },
      { label: 'Students' },
    ],
  },
};

export const ThreeLevels: Story = {
  args: {
    items: [
      { label: 'School', href: '/school/dashboard' },
      { label: 'Content', href: '/school/content' },
      { label: 'Lesson 1' },
    ],
  },
};

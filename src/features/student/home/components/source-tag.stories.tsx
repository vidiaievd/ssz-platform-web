import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { SourceTag } from './source-tag';

const meta = {
  title: 'Student/Home/SourceTag',
  component: SourceTag,
  decorators: [
    (Story) => (
      <div className="flex gap-2">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof SourceTag>;

export default meta;
type Story = StoryObj<typeof meta>;

export const School: Story = { args: { source: 'school' } };
export const SelfStudy: Story = { args: { source: 'self' } };
export const Free: Story = { args: { source: 'free' } };
export const Subscription: Story = { args: { source: 'paid' } };

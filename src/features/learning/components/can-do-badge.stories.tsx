import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { CanDoBadge } from './can-do-badge';

const TEXT = 'I can describe my job and talk about a typical work day in Norwegian.';

const meta = {
  title: 'Learning/CanDoBadge',
  component: CanDoBadge,
  decorators: [(Story) => <div className="max-w-sm p-4"><Story /></div>],
} satisfies Meta<typeof CanDoBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Locked: Story = {
  args: { text: TEXT, state: 'locked' },
};

export const InProgress: Story = {
  args: { text: TEXT, state: 'in-progress' },
};

export const Unlocked: Story = {
  args: { text: TEXT, state: 'unlocked' },
};

export const AllStates: Story = {
  args: { text: TEXT },
  render: () => (
    <div className="flex flex-col gap-3">
      <CanDoBadge text={TEXT} state="locked" />
      <CanDoBadge text={TEXT} state="in-progress" />
      <CanDoBadge text={TEXT} state="unlocked" />
    </div>
  ),
};

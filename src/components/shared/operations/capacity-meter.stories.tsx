import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { CapacityMeter } from './capacity-meter';

const meta = {
  title: 'Shared/Operations/CapacityMeter',
  component: CapacityMeter,
  parameters: { layout: 'padded' },
  args: { min: 4, max: 12 },
} satisfies Meta<typeof CapacityMeter>;

export default meta;
type Story = StoryObj<typeof meta>;

export const UnderMinimum: Story = {
  args: { count: 2 },
};

export const WithinCapacity: Story = {
  args: { count: 8 },
};

export const AtMax: Story = {
  args: { count: 12 },
};

export const OverCapacity: Story = {
  args: { count: 14 },
};

export const ProjectedOver: Story = {
  name: 'Projected — would exceed max',
  args: { count: 10, projected: 14 },
};

export const ProjectedOk: Story = {
  name: 'Projected — within capacity',
  args: { count: 6, projected: 9 },
};

export const SmallSize: Story = {
  args: { count: 7, size: 'sm' },
};

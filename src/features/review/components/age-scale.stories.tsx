import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { AgeMark } from './age-mark';
import { AgeSpread } from './age-spread';

const SLA = 24;

const meta = {
  title: 'Review/AgeScale',
  component: AgeMark,
  parameters: { layout: 'padded' },
  args: { slaHours: SLA },
} satisfies Meta<typeof AgeMark>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Fresh: Story = { args: { hours: 1 } };
export const HalfwayToThePromise: Story = { args: { hours: 12 } };
export const AtThePromise: Story = { args: { hours: SLA } };
export const PastThePromise: Story = { args: { hours: 34 } };
export const TwiceThePromise: Story = { args: { hours: 2 * SLA } };
export const FarPastAndIndistinguishable: Story = {
  name: 'Five times the promise — the same as twice it, on purpose',
  args: { hours: 5 * SLA },
};

/** The whole scale in one column: what a teacher learns to read at a glance. */
export const TheWholeScale: Story = {
  args: { hours: 0 },
  render: (args) => (
    <div className="flex flex-col gap-3">
      {[0.5, 6, 12, 18, 24, 30, 40, 48, 120].map((hours) => (
        <AgeMark key={hours} {...args} hours={hours} />
      ))}
    </div>
  ),
};

/**
 * Two queues of the same size, one with a tail. The count cannot tell them apart; this is
 * the whole argument for the histogram.
 */
export const SameCountDifferentShape: Story = {
  args: { hours: 0 },
  render: () => (
    <div className="flex flex-col gap-6" style={{ width: 280 }}>
      <div className="flex flex-col gap-2">
        <span className="text-xs font-semibold">12 waiting · even</span>
        <AgeSpread hours={[2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]} slaHours={SLA} height={14} />
      </div>
      <div className="flex flex-col gap-2">
        <span className="text-xs font-semibold">12 waiting · long tail</span>
        <AgeSpread hours={[2, 2, 3, 3, 4, 4, 5, 5, 60, 92, 130, 180]} slaHours={SLA} height={14} />
      </div>
    </div>
  ),
};

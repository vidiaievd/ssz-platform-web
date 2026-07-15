import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { PhoneFrame } from './phone-frame';

const meta = {
  title: 'ContentAuthoring/PhoneFrame',
  component: PhoneFrame,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof PhoneFrame>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  args: { children: null },
};

export const WithContent: Story = {
  args: {
    children: (
      <div className="p-4 text-sm text-(--ssz-text-primary)">
        <p className="font-bold">En vanlig arbeidsdag</p>
        <p className="mt-2 text-(--ssz-text-secondary)">
          Marta begynner arbeidsdagen klokka sju om morgenen.
        </p>
      </div>
    ),
  },
};

export const TallContent: Story = {
  args: {
    children: (
      <div className="flex flex-col gap-3 p-4 text-sm text-(--ssz-text-primary)">
        {Array.from({ length: 20 }).map((_, i) => (
          <p key={i}>Line {i + 1} — scrolls inside the fixed phone screen.</p>
        ))}
      </div>
    ),
  },
};

import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { CheckEmailScreen } from './check-email-screen';

const meta = {
  title: 'Auth/CheckEmailScreen',
  component: CheckEmailScreen,
  parameters: { layout: 'centered' },
} satisfies Meta<typeof CheckEmailScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

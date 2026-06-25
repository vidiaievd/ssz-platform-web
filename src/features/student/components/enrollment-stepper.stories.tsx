import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { EnrollmentStepper } from './enrollment-stepper';

const meta = {
  title: 'Student/EnrollmentStepper',
  component: EnrollmentStepper,
} satisfies Meta<typeof EnrollmentStepper>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Pending: Story = {
  args: { status: 'pending' },
};

export const Onboarding: Story = {
  args: { status: 'onboarding' },
};

export const PlacementReview: Story = {
  args: { status: 'placement-review' },
};

export const Active: Story = {
  args: { status: 'active' },
};

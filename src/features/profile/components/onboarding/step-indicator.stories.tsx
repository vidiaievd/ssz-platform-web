import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { StepIndicator } from './step-indicator';

const meta = {
  title: 'Onboarding/StepIndicator',
  component: StepIndicator,
  parameters: { layout: 'padded' },
  args: {
    stepNames: ['Profile', 'Preferences'],
    progressLabel: 'Step 1 of 2',
  },
} satisfies Meta<typeof StepIndicator>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ProfileStep: Story = {
  args: { currentStep: 'profile', progressLabel: 'Step 1 of 2' },
};

export const PrefsStep: Story = {
  args: { currentStep: 'prefs', progressLabel: 'Step 2 of 2' },
};

export const TutorStepNames: Story = {
  name: 'Tutor — Details step',
  args: {
    currentStep: 'prefs',
    stepNames: ['Profile', 'Details'],
    progressLabel: 'Step 2 of 2',
  },
};

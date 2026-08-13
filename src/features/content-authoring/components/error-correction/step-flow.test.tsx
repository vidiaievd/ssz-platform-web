import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import {
  DEFAULT_AI,
  DEFAULT_CHECK,
  DEFAULT_FLOW,
  DEFAULT_HINTS,
  type ErrorCorrection,
} from '@/lib/shared-kernel/error-correction';

import { StepFlow } from './step-flow';

function doc(overrides: Partial<ErrorCorrection> = {}): ErrorCorrection {
  return {
    id: 'ex-1',
    type: 'error_correction',
    moduleId: 'module-1',
    title: '',
    instructions: 'Finn feilen.',
    mode: 'sentences',
    note: '',
    items: [
      {
        id: 'i1',
        wrong: 'I går jeg gikk på kino.',
        ref: 'I går gikk jeg på kino.',
        alts: [],
        meta: {},
      },
    ],
    hints: { ...DEFAULT_HINTS },
    check: { ...DEFAULT_CHECK },
    flow: { ...DEFAULT_FLOW },
    ai: { ...DEFAULT_AI },
    updatedAt: '2026-08-12T10:00:00.000Z',
    ...overrides,
  };
}

function renderStep(exercise: ErrorCorrection = doc()) {
  const onChange = vi.fn();
  render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <StepFlow exercise={exercise} onChange={onChange} />
    </NextIntlClientProvider>,
  );
  return { onChange, user: userEvent.setup() };
}

describe('StepFlow', () => {
  it('draws the road the answer takes, reading the settings already made', () => {
    renderStep();

    expect(screen.getByText('2 self-checks before handing in')).toBeInTheDocument();
    expect(screen.getByText('Compares against the answer key, word by word')).toBeInTheDocument();
    expect(
      screen.getByText('Sees everything that was not approved automatically'),
    ).toBeInTheDocument();
  });

  it('shows the automatic stage as off when the author turned the check off', () => {
    renderStep(doc({ check: { ...DEFAULT_CHECK, on: false } }));

    expect(screen.getByText('Off')).toBeInTheDocument();
  });

  it('sets how many self-checks the student gets, and what that means', async () => {
    const { onChange, user } = renderStep();

    expect(screen.getByText(/never which words are left/)).toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: 'None' }));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ flow: expect.objectContaining({ selfCheck: 0 }) }),
    );
  });

  it('has nowhere to show the tally when there is no self-check', () => {
    renderStep(doc({ flow: { ...DEFAULT_FLOW, selfCheck: 0 } }));

    expect(screen.getByRole('switch', { name: /Show how many are corrected/ })).toBeDisabled();
    expect(screen.getByText(/no self-check to show it in/)).toBeInTheDocument();
    expect(screen.getByText('No self-check — they hand in blind')).toBeInTheDocument();
  });

  it('sets the æøå keyboard', async () => {
    const { onChange, user } = renderStep();

    await user.click(screen.getByRole('switch', { name: /Keyboard with/ }));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ flow: expect.objectContaining({ keyboard: false }) }),
    );
  });

  it('sets whether a second attempt is allowed', async () => {
    const { onChange, user } = renderStep();

    await user.click(screen.getByRole('radio', { name: 'One attempt' }));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ flow: expect.objectContaining({ attempts: 'once' }) }),
    );
  });

  it('says what showing the answer key when it does costs', async () => {
    const { onChange, user } = renderStep();

    expect(screen.getByText(/comes with the teacher's feedback/)).toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: 'Right after handing in' }));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ flow: expect.objectContaining({ showRefs: 'afterSubmit' }) }),
    );
  });

  it('promises nothing about an AI stage that is not connected', () => {
    renderStep();

    expect(screen.queryByText(/AI/)).not.toBeInTheDocument();
  });
});

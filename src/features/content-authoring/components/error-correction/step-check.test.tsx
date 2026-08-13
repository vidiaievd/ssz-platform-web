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
  type Item,
} from '@/lib/shared-kernel/error-correction';

// The tester has its own tests, and it answers to the same sentences as this step reads.
vi.mock('./ec-tester', () => ({ EcTester: () => null }));

const { StepCheck } = await import('./step-check');

const item = (id: string, wrong: string, ref: string): Item => ({
  id,
  wrong,
  ref,
  alts: [],
  meta: {},
});

function doc(overrides: Partial<ErrorCorrection> = {}): ErrorCorrection {
  return {
    id: 'ex-1',
    type: 'error_correction',
    moduleId: 'module-1',
    title: '',
    instructions: 'Finn feilen.',
    mode: 'sentences',
    note: '',
    items: [item('i1', 'I går jeg gikk på kino.', 'I går gikk jeg på kino.')],
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
      <StepCheck exercise={exercise} onChange={onChange} />
    </NextIntlClientProvider>,
  );
  return { onChange, user: userEvent.setup() };
}

describe('StepCheck', () => {
  it('counts the real mistakes when explaining what the student would be told', () => {
    renderStep(
      doc({
        items: [
          item('i1', 'I går jeg gikk på kino.', 'I går gikk jeg på kino.'),
          item('i2', 'Hun har kjøp en bil.', 'Hun har kjøpt en bil.'),
        ],
      }),
    );

    expect(screen.getByText(/“2 mistakes to find” stands at the top/)).toBeInTheDocument();
  });

  it('writes a hint switch into the document', async () => {
    const { onChange, user } = renderStep();

    await user.click(screen.getByRole('switch', { name: /Show the kind of mistake/ }));

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ hints: expect.objectContaining({ showType: true }) }),
    );
  });

  it('offers marking sentences only where there are sentences to mark', () => {
    renderStep();
    expect(screen.queryByRole('switch', { name: /Mark the sentences/ })).not.toBeInTheDocument();

    render(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <StepCheck exercise={doc({ mode: 'passage' })} onChange={vi.fn()} />
      </NextIntlClientProvider>,
    );
    expect(screen.getByRole('switch', { name: /Mark the sentences/ })).toBeInTheDocument();
  });

  it('hides the settings that only mean something while the check runs', async () => {
    const { onChange, user } = renderStep();
    expect(screen.getByRole('switch', { name: /Accept one letter/ })).toBeInTheDocument();

    await user.click(screen.getByRole('switch', { name: /Check answers automatically/ }));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ check: expect.objectContaining({ on: false }) }),
    );
  });

  it('warns that nothing is approved at all when the check is off', () => {
    renderStep(doc({ check: { ...DEFAULT_CHECK, on: false } }));

    expect(screen.getByText(/every single answer lands in the teacher/)).toBeInTheDocument();
    expect(screen.queryByRole('switch', { name: /Accept one letter/ })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('radiogroup', { name: 'Changes outside the mistakes' }),
    ).not.toBeInTheDocument();
  });

  it('explains what the stray-edit policy on screen actually does', async () => {
    const { onChange, user } = renderStep();

    expect(screen.getByText(/the teacher sees what else was touched/)).toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: 'Block approval' }));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ check: expect.objectContaining({ strayEdits: 'block' }) }),
    );
  });

  it('makes a switch inert when it could not change anything, and says why', async () => {
    const { onChange, user } = renderStep(doc({ check: { ...DEFAULT_CHECK, exactPass: false } }));

    const requireAll = screen.getByRole('switch', { name: /Require every mistake/ });
    expect(requireAll).toBeDisabled();
    expect(screen.getByText(/Nothing is approved automatically/)).toBeInTheDocument();

    await user.click(requireAll);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('will not offer to unlock a hint nobody has written', () => {
    renderStep();
    expect(screen.getByRole('switch', { name: /Hints can be opened/ })).toBeDisabled();
    expect(screen.getByText(/No hints written yet/)).toBeInTheDocument();
  });

  it('offers it as soon as one sentence carries a hint', () => {
    renderStep(
      doc({
        items: [
          {
            ...item('i1', 'I går jeg gikk på kino.', 'I går gikk jeg på kino.'),
            hint: 'Hva skjer med verbet?',
          },
        ],
      }),
    );

    expect(screen.getByRole('switch', { name: /Hints can be opened/ })).toBeEnabled();
  });

  it('sets the threshold, and reports the one the document carries', async () => {
    const { onChange, user } = renderStep();

    expect(screen.getByText(/from 85% similarity/)).toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: 'Strict' }));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ check: expect.objectContaining({ near: 0.95 }) }),
    );
  });

  it('shows the nearest step for a threshold that is not one of the three', () => {
    // A document may carry any number — the server accepts one. Showing nothing selected
    // would suggest the setting is unset, when it is merely between two labels.
    renderStep(doc({ check: { ...DEFAULT_CHECK, near: 0.9 } }));

    expect(screen.getByRole('radio', { name: 'Strict' })).toBeChecked();
    expect(screen.getByText(/from 90% similarity/)).toBeInTheDocument();
  });
});

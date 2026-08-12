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

import { StepFormat } from './step-format';

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
    instructions: 'Finn feilen i hver setning.',
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
      <StepFormat exercise={exercise} onChange={onChange} />
    </NextIntlClientProvider>,
  );
  return { onChange, user: userEvent.setup() };
}

describe('StepFormat', () => {
  it('switches format and says what it changes for the student', async () => {
    const { onChange, user } = renderStep();

    expect(screen.getByText(/correct them in any order/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /One continuous text/ }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ mode: 'passage' }));
  });

  it('warns when a continuous text is spread over several blocks, keeping them', async () => {
    const items = [
      item('i1', 'I går jeg gikk på kino.', 'I går gikk jeg på kino.'),
      item('i2', 'Hun har kjøp en bil.', 'Hun har kjøpt en bil.'),
    ];
    renderStep(doc({ mode: 'passage', items }));

    expect(screen.getByText(/2 text blocks here/)).toBeInTheDocument();
  });

  it('flags an empty task line, which cannot be published', () => {
    renderStep(doc({ instructions: '   ' }));

    expect(screen.getByLabelText('Task line')).toHaveAttribute('aria-invalid', 'true');
  });

  it('writes the context line into the document', async () => {
    const { onChange, user } = renderStep();

    await user.type(screen.getByLabelText(/Context/), 'B');
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ note: 'B' }));
  });
});

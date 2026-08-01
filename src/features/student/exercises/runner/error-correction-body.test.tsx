import { fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';

import { PRACTICE_ACCENT } from './types';
import { ErrorCorrectionBody, type ErrorCorrectionContent } from './error-correction-body';

const content: ErrorCorrectionContent = {
  mistakeCount: 1,
  items: [
    {
      id: 's-0',
      chunks: [
        { id: 'c-0', text: 'I could see' },
        { id: 'c-1', text: 'she was warming up with me' },
      ],
    },
  ],
};

function renderBody(props: Partial<React.ComponentProps<typeof ErrorCorrectionBody>> = {}) {
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <ErrorCorrectionBody
        content={content}
        value={{}}
        onValueChange={vi.fn()}
        onAnswerChange={vi.fn()}
        phase="answering"
        ok={null}
        mode="practice"
        accent={PRACTICE_ACCENT}
        {...props}
      />
    </NextIntlClientProvider>,
  );
}

describe('ErrorCorrectionBody', () => {
  it('renders every chunk as its own control', () => {
    renderBody();

    expect(screen.getByRole('button', { name: 'I could see' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'she was warming up with me' })).toBeInTheDocument();
    expect(screen.getByText('Corrections made: 0 of 1')).toBeInTheDocument();
  });

  it('records a rewrite for the chunk that was edited', () => {
    const onValueChange = vi.fn();
    renderBody({ onValueChange });

    fireEvent.click(screen.getByRole('button', { name: 'she was warming up with me' }));
    fireEvent.blur(screen.getByRole('textbox'), {
      target: { value: 'she was warming to me' },
    });

    expect(onValueChange).toHaveBeenCalledWith({ 's-0': { 'c-1': 'she was warming to me' } });
  });

  it('drops an edit that ends up identical to the original', () => {
    const onValueChange = vi.fn();
    renderBody({ onValueChange, value: { 's-0': { 'c-1': 'something else' } } });

    fireEvent.click(screen.getByRole('button', { name: 'something else' }));
    fireEvent.blur(screen.getByRole('textbox'), {
      target: { value: '  she was warming up with me ' },
    });

    // The whole sentence entry goes away, not just the chunk.
    expect(onValueChange).toHaveBeenCalledWith({});
  });

  it('only allows submitting once something was rewritten', () => {
    const onAnswerChange = vi.fn();
    renderBody({ onAnswerChange });
    expect(onAnswerChange).toHaveBeenLastCalledWith(false);

    renderBody({ onAnswerChange, value: { 's-0': { 'c-1': 'fixed' } } });
    expect(onAnswerChange).toHaveBeenLastCalledWith(true);
  });

  it('shows the expected wording for a missed mistake and locks editing', () => {
    renderBody({
      phase: 'feedback',
      ok: false,
      results: {
        's-0': { 'c-1': { outcome: 'missed', expected: 'she was warming to me' } },
      },
    });

    expect(screen.getByText('she was warming to me')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'I could see' })).toBeDisabled();
  });

  it('marks a rewritten sound chunk as a false positive', () => {
    renderBody({
      phase: 'feedback',
      ok: false,
      value: { 's-0': { 'c-0': 'I saw' } },
      results: { 's-0': { 'c-0': { outcome: 'false_positive' } } },
    });

    const chunk = screen.getByRole('button', { name: 'I saw' });
    expect(chunk.style.textDecoration).toBe('line-through');
  });
});

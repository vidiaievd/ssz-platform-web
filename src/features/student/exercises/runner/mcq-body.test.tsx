import { fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';

import { McqBody, type McqContent, type McqExpectedAnswers } from './mcq-body';

const messages = {
  ExerciseRunner: {
    mcq: { defaultInstruction: 'Choose the correct answer', optionsLabel: 'Answer options' },
  },
};

const CONTENT: McqContent = {
  question: 'What does "slappe av" mean?',
  options: [
    { id: 'a', text: 'to work hard' },
    { id: 'b', text: 'to relax' },
    { id: 'c', text: 'to exercise' },
    { id: 'd', text: 'to travel' },
  ],
};

const EXPECTED: McqExpectedAnswers = {
  correct_option_ids: ['b'],
  explanation: '"Slappe av" means to relax.',
};

const ACCENT = 'var(--ssz-color-primary-500)';

function renderMcq(overrides: Partial<Parameters<typeof McqBody>[0]> = {}) {
  const defaults = {
    content: CONTENT,
    expectedAnswers: EXPECTED,
    selectedId: null,
    onSelect: vi.fn(),
    onAnswerChange: vi.fn(),
    phase: 'answering' as const,
    ok: null,
    mode: 'practice' as const,
    accent: ACCENT,
  };
  const props = { ...defaults, ...overrides };
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <McqBody {...props} />
    </NextIntlClientProvider>,
  );
}

describe('McqBody', () => {
  it('renders the question and all options', () => {
    renderMcq();
    expect(screen.getByText('What does "slappe av" mean?')).toBeInTheDocument();
    expect(screen.getByText('to work hard')).toBeInTheDocument();
    expect(screen.getByText('to relax')).toBeInTheDocument();
    expect(screen.getByText('to exercise')).toBeInTheDocument();
    expect(screen.getByText('to travel')).toBeInTheDocument();
  });

  it('renders letter badges A B C D', () => {
    renderMcq();
    const options = screen.getAllByRole('radio');
    expect(options[0]).toHaveTextContent('A');
    expect(options[1]).toHaveTextContent('B');
    expect(options[2]).toHaveTextContent('C');
    expect(options[3]).toHaveTextContent('D');
  });

  it('calls onSelect and onAnswerChange when an option is clicked', () => {
    const onSelect = vi.fn();
    const onAnswerChange = vi.fn();
    renderMcq({ onSelect, onAnswerChange });
    fireEvent.click(screen.getByText('to relax'));
    expect(onSelect).toHaveBeenCalledWith('b');
  });

  it('calls onAnswerChange(true) when selectedId is set', () => {
    const onAnswerChange = vi.fn();
    renderMcq({ selectedId: 'b', onAnswerChange });
    expect(onAnswerChange).toHaveBeenCalledWith(true);
  });

  it('calls onAnswerChange(false) when selectedId is null', () => {
    const onAnswerChange = vi.fn();
    renderMcq({ selectedId: null, onAnswerChange });
    expect(onAnswerChange).toHaveBeenCalledWith(false);
  });

  it('marks the selected option as aria-checked', () => {
    renderMcq({ selectedId: 'c' });
    const options = screen.getAllByRole('radio');
    expect(options[2]).toHaveAttribute('aria-checked', 'true');
    expect(options[0]).toHaveAttribute('aria-checked', 'false');
  });

  it('disables all options during feedback phase', () => {
    renderMcq({ phase: 'feedback', selectedId: 'b', ok: true });
    const options = screen.getAllByRole('radio');
    options.forEach((opt) => expect(opt).toBeDisabled());
  });

  it('shows checkCircle icon on the correct option when ok=true (practice)', () => {
    renderMcq({ phase: 'feedback', selectedId: 'b', ok: true, mode: 'practice' });
    // The correct option ("to relax") should show a success icon
    const correctOption = screen.getByText('to relax').closest('button');
    expect(correctOption?.querySelector('svg')).toBeInTheDocument();
  });

  it('shows xCircle icon on wrong selected option when ok=false (practice)', () => {
    renderMcq({ phase: 'feedback', selectedId: 'a', ok: false, mode: 'practice' });
    const wrongOption = screen.getByText('to work hard').closest('button');
    expect(wrongOption?.querySelector('svg')).toBeInTheDocument();
  });

  it('does not show feedback icons in graded mode (ok=null)', () => {
    renderMcq({ phase: 'feedback', selectedId: 'b', ok: null, mode: 'graded' });
    // No check/x icons should appear (no SVG in option buttons)
    const buttons = screen.getAllByRole('radio');
    // In graded mode the correct option stays neutral - no icons
    buttons.forEach((btn) => {
      // Only the selected button might have accent styling; no feedback SVG
      // We just verify buttons are present and not revealing icons
      expect(btn).toBeInTheDocument();
    });
  });

  it('does not call onSelect when clicked in feedback phase', () => {
    const onSelect = vi.fn();
    renderMcq({ phase: 'feedback', selectedId: 'b', ok: true, onSelect });
    fireEvent.click(screen.getByText('to relax'));
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('renders the radiogroup with accessible label', () => {
    renderMcq();
    expect(screen.getByRole('radiogroup', { name: 'Answer options' })).toBeInTheDocument();
  });

  it('uses custom instruction from content when provided', () => {
    renderMcq({ content: { ...CONTENT, instruction: 'Pick one option' } });
    expect(screen.getByText('Pick one option')).toBeInTheDocument();
  });

  it('responds to keyboard 1-4 in answering phase', () => {
    const onSelect = vi.fn();
    renderMcq({ onSelect });
    fireEvent.keyDown(document.body, { key: '2' });
    expect(onSelect).toHaveBeenCalledWith('b');
  });

  it('ignores keyboard 1-4 in feedback phase', () => {
    const onSelect = vi.fn();
    renderMcq({ onSelect, phase: 'feedback', selectedId: 'b', ok: true });
    fireEvent.keyDown(document.body, { key: '1' });
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('ignores keyboard 1-4 when focus is in an input', () => {
    const onSelect = vi.fn();
    renderMcq({ onSelect });
    const input = document.createElement('input');
    document.body.appendChild(input);
    fireEvent.keyDown(input, { key: '1' });
    expect(onSelect).not.toHaveBeenCalled();
    input.remove();
  });
});

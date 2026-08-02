import { fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';

import { FillBody, type FillContent, type FillRationale } from './fill-body';

const messages = {
  ExerciseRunner: {
    fill: {
      defaultInstruction: 'Complete the sentence',
      blankLabel: 'Blank',
      inputLabel: 'Your answer',
      placeholder: 'type…',
      rationaleTitle: 'Why this answer',
      optionHeader: 'Option',
      verdictHeader: 'Fits?',
      noteHeader: 'Why',
      verdictCorrect: 'Correct',
      verdictAcceptable: 'Possible, but not here',
      verdictWrong: 'Wrong',
    },
  },
};

const RATIONALE: FillRationale = {
  explanation: 'A statement is introduced by «at».',
  options: [
    { text: 'at', verdict: 'correct', note: 'Statement → at.' },
    { text: 'om', verdict: 'wrong', note: 'Only for yes/no questions.' },
    { text: 'hvorfor', verdict: 'acceptable', note: 'Grammatical, but not in this context.' },
  ],
};

const CONTENT_WB: FillContent = {
  textWithBlanks: 'Etter jobb liker Marta å slappe av ___1___ .',
  gloss: 'After work Marta likes to relax at home.',
  wordBank: ['hjemme', 'jobben', 'sykehuset', 'morgenen'],
};

const CONTENT_FREE: FillContent = {
  textWithBlanks: 'Etter jobb liker Marta å slappe av ___1___ .',
  gloss: 'After work Marta likes to relax at home.',
};

const ACCENT = 'var(--ssz-color-primary-500)';

function renderFill(overrides: Partial<Parameters<typeof FillBody>[0]> = {}) {
  const defaults = {
    content: CONTENT_WB,
    value: '',
    onValueChange: vi.fn(),
    onAnswerChange: vi.fn(),
    phase: 'answering' as const,
    ok: null,
    mode: 'practice' as const,
    accent: ACCENT,
  };
  const props = { ...defaults, ...overrides };
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <FillBody {...props} />
    </NextIntlClientProvider>,
  );
}

/* ── parseBlanks (internal behavior via rendering) ───────────────── */

describe('FillBody — sentence splitting', () => {
  it('renders the before and after parts of the sentence', () => {
    renderFill();
    expect(screen.getByText(/Etter jobb/)).toBeInTheDocument();
    // The after segment " ." appears as a span
    const afterSpans = screen.getAllByText(/\./);
    expect(afterSpans.length).toBeGreaterThan(0);
  });

  it('renders the gloss above the sentence', () => {
    renderFill();
    expect(
      screen.getByText('After work Marta likes to relax at home.'),
    ).toBeInTheDocument();
  });

  it('does not render gloss when absent', () => {
    renderFill({ content: { ...CONTENT_WB, gloss: undefined } });
    expect(
      screen.queryByText('After work Marta likes to relax at home.'),
    ).not.toBeInTheDocument();
  });
});

/* ── word bank mode ──────────────────────────────────────────────── */

describe('FillBody — word bank mode', () => {
  it('renders all word bank chips', () => {
    renderFill();
    expect(screen.getByText('hjemme')).toBeInTheDocument();
    expect(screen.getByText('jobben')).toBeInTheDocument();
    expect(screen.getByText('sykehuset')).toBeInTheDocument();
    expect(screen.getByText('morgenen')).toBeInTheDocument();
  });

  it('clicking a chip calls onValueChange with that word', () => {
    const onValueChange = vi.fn();
    renderFill({ onValueChange });
    fireEvent.click(screen.getByText('hjemme'));
    expect(onValueChange).toHaveBeenCalledWith('hjemme');
  });

  it('clicking the selected chip clears the value (toggle off)', () => {
    const onValueChange = vi.fn();
    renderFill({ value: 'hjemme', onValueChange });
    // When value is set, the blank slot also shows 'hjemme'; target the chip button directly
    const hjemmeBtn = screen.getByRole('button', { name: 'hjemme' });
    fireEvent.click(hjemmeBtn);
    expect(onValueChange).toHaveBeenCalledWith('');
  });

  it('chips are disabled in feedback phase', () => {
    renderFill({ phase: 'feedback', value: 'hjemme', ok: true });
    const buttons = screen.getAllByRole('button');
    buttons.forEach((btn) => expect(btn).toBeDisabled());
  });

  it('does not render a free-type input', () => {
    renderFill();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('keyboard 1-4 selects the corresponding chip word', () => {
    const onValueChange = vi.fn();
    renderFill({ onValueChange });
    fireEvent.keyDown(document.body, { key: '1' });
    expect(onValueChange).toHaveBeenCalledWith('hjemme');
  });

  it('keyboard key for selected chip clears the value (toggle)', () => {
    const onValueChange = vi.fn();
    renderFill({ value: 'hjemme', onValueChange });
    fireEvent.keyDown(document.body, { key: '1' });
    expect(onValueChange).toHaveBeenCalledWith('');
  });

  it('keyboard 1-4 ignored in feedback phase', () => {
    const onValueChange = vi.fn();
    renderFill({ phase: 'feedback', value: 'hjemme', ok: true, onValueChange });
    fireEvent.keyDown(document.body, { key: '2' });
    expect(onValueChange).not.toHaveBeenCalled();
  });
});

/* ── free-type mode ──────────────────────────────────────────────── */

describe('FillBody — free-type mode', () => {
  it('renders an input and no chips', () => {
    renderFill({ content: CONTENT_FREE });
    expect(screen.getByRole('textbox')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('input changes call onValueChange', () => {
    const onValueChange = vi.fn();
    renderFill({ content: CONTENT_FREE, onValueChange });
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'hjemme' } });
    expect(onValueChange).toHaveBeenCalledWith('hjemme');
  });

  it('input is disabled in feedback phase', () => {
    renderFill({ content: CONTENT_FREE, phase: 'feedback', value: 'hjemme', ok: true });
    expect(screen.getByRole('textbox')).toBeDisabled();
  });
});

/* ── onAnswerChange ──────────────────────────────────────────────── */

describe('FillBody — onAnswerChange', () => {
  it('calls onAnswerChange(false) when value is empty', () => {
    const onAnswerChange = vi.fn();
    renderFill({ value: '', onAnswerChange });
    expect(onAnswerChange).toHaveBeenCalledWith(false);
  });

  it('calls onAnswerChange(true) when value is non-empty', () => {
    const onAnswerChange = vi.fn();
    renderFill({ value: 'hjemme', onAnswerChange });
    expect(onAnswerChange).toHaveBeenCalledWith(true);
  });

  it('calls onAnswerChange(false) for whitespace-only value', () => {
    const onAnswerChange = vi.fn();
    renderFill({ value: '   ', onAnswerChange });
    expect(onAnswerChange).toHaveBeenCalledWith(false);
  });
});

/* ── reveal states ───────────────────────────────────────────────── */

describe('FillBody — reveal states (word bank)', () => {
  it('correct chip gets success styling on ok=true', () => {
    renderFill({ phase: 'feedback', value: 'hjemme', ok: true });
    const correctChip = screen.getByRole('button', { name: 'hjemme' });
    expect(correctChip.getAttribute('style')).toContain('feedback-ok-line');
  });

  it('wrong chip gets error styling on ok=false', () => {
    renderFill({ phase: 'feedback', value: 'jobben', ok: false });
    const wrongChip = screen.getByRole('button', { name: 'jobben' });
    expect(wrongChip.getAttribute('style')).toContain('feedback-no-line');
  });

  it('graded mode (ok=null) keeps selected chip in accent color', () => {
    renderFill({
      phase: 'feedback',
      value: 'hjemme',
      ok: null,
      mode: 'graded',
      accent: 'var(--ssz-color-secondary-600)',
    });
    const chip = screen.getByRole('button', { name: 'hjemme' });
    expect(chip.getAttribute('style')).toContain('secondary-600');
  });

  describe('rationale matrix', () => {
    it('is hidden while answering, even when authored', () => {
      renderFill({ phase: 'answering', value: 'hjemme', ok: null, rationale: RATIONALE });
      expect(screen.queryByRole('table')).toBeNull();
      expect(screen.queryByText('Why this answer')).toBeNull();
    });

    it('renders every option with its verdict and note in the feedback phase', () => {
      renderFill({ phase: 'feedback', value: 'hjemme', ok: true, rationale: RATIONALE });

      expect(screen.getByText('Why this answer')).toBeInTheDocument();
      expect(screen.getByText('A statement is introduced by «at».')).toBeInTheDocument();

      // one row per analysed option, each carrying its verdict label and note
      expect(screen.getByRole('table')).toBeInTheDocument();
      expect(screen.getByText('at')).toBeInTheDocument();
      expect(screen.getByText('Correct')).toBeInTheDocument();
      expect(screen.getByText('Statement → at.')).toBeInTheDocument();
      expect(screen.getByText('Wrong')).toBeInTheDocument();
      expect(screen.getByText('Only for yes/no questions.')).toBeInTheDocument();
      expect(screen.getByText('Possible, but not here')).toBeInTheDocument();
    });

    it('is shown after a wrong answer too, so the rule is still taught', () => {
      renderFill({ phase: 'feedback', value: 'jobben', ok: false, rationale: RATIONALE });
      expect(screen.getByRole('table')).toBeInTheDocument();
      expect(screen.getByText('Statement → at.')).toBeInTheDocument();
    });

    it('renders nothing extra when the exercise has no rationale', () => {
      renderFill({ phase: 'feedback', value: 'hjemme', ok: true });
      expect(screen.queryByRole('table')).toBeNull();
      expect(screen.queryByText('Why this answer')).toBeNull();
    });

    it('renders the explanation alone when no options are given', () => {
      renderFill({
        phase: 'feedback',
        value: 'hjemme',
        ok: true,
        rationale: { explanation: 'Just the rule.' },
      });
      expect(screen.getByText('Just the rule.')).toBeInTheDocument();
      expect(screen.queryByRole('table')).toBeNull();
    });
  });
});

import { fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';

import { FreeTextBody, type FreeTextContent } from './free-text-body';

const messages = {
  Placement: {
    runner: {
      freeText: {
        defaultInstruction: 'Translate the sentence',
        textareaLabel: 'Your translation',
        placeholder: 'Write in {lang}…',
        sampleAnswer: 'Sample answer',
      },
    },
  },
};

const CONTENT_TO: FreeTextContent = {
  direction: 'to',
  fromLabel: 'English',
  toLabel: 'Norwegian',
  sourceText: 'It is a busy profession.',
  sampleAnswer: 'Det er et travelt yrke.',
};

const CONTENT_FROM: FreeTextContent = {
  direction: 'from',
  fromLabel: 'Norwegian',
  toLabel: 'English',
  sourceText: 'Det er et travelt yrke.',
  sampleAnswer: 'It is a busy profession.',
};

const ACCENT = 'var(--ssz-color-primary-500)';

function renderFreeText(overrides: Partial<Parameters<typeof FreeTextBody>[0]> = {}) {
  const defaults = {
    content: CONTENT_TO,
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
      <FreeTextBody {...props} />
    </NextIntlClientProvider>,
  );
}

/* ── rendering ───────────────────────────────────────────────────── */

describe('FreeTextBody — rendering', () => {
  it('renders the source text', () => {
    renderFreeText();
    expect(screen.getByText('It is a busy profession.')).toBeInTheDocument();
  });

  it('renders from/to language labels', () => {
    renderFreeText();
    expect(screen.getByText('English')).toBeInTheDocument();
    expect(screen.getByText('Norwegian')).toBeInTheDocument();
  });

  it('renders correct language labels for "from" direction', () => {
    renderFreeText({ content: CONTENT_FROM });
    expect(screen.getByText('Norwegian')).toBeInTheDocument();
    expect(screen.getByText('English')).toBeInTheDocument();
  });

  it('renders the textarea with correct aria-label', () => {
    renderFreeText();
    expect(screen.getByRole('textbox', { name: 'Your translation' })).toBeInTheDocument();
  });

  it('renders placeholder indicating target language', () => {
    renderFreeText();
    expect(screen.getByPlaceholderText('Write in Norwegian…')).toBeInTheDocument();
  });

  it('renders placeholder indicating target language for "from" direction', () => {
    renderFreeText({ content: CONTENT_FROM });
    expect(screen.getByPlaceholderText('Write in English…')).toBeInTheDocument();
  });

  it('uses custom instruction when provided', () => {
    renderFreeText({
      content: { ...CONTENT_TO, instruction: 'Put it in Norwegian' },
    });
    expect(screen.getByText('Put it in Norwegian')).toBeInTheDocument();
  });

  it('uses default instruction when none provided', () => {
    renderFreeText();
    expect(screen.getByText('Translate the sentence')).toBeInTheDocument();
  });
});

/* ── textarea interaction ────────────────────────────────────────── */

describe('FreeTextBody — textarea interaction', () => {
  it('calls onValueChange when user types', () => {
    const onValueChange = vi.fn();
    renderFreeText({ onValueChange });
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'Det er et travelt yrke.' },
    });
    expect(onValueChange).toHaveBeenCalledWith('Det er et travelt yrke.');
  });

  it('textarea is disabled in feedback phase', () => {
    renderFreeText({ phase: 'feedback', value: 'Det er et travelt yrke.', ok: true });
    expect(screen.getByRole('textbox')).toBeDisabled();
  });

  it('textarea is enabled in answering phase', () => {
    renderFreeText();
    expect(screen.getByRole('textbox')).not.toBeDisabled();
  });
});

/* ── onAnswerChange ──────────────────────────────────────────────── */

describe('FreeTextBody — onAnswerChange', () => {
  it('calls onAnswerChange(false) for empty value', () => {
    const onAnswerChange = vi.fn();
    renderFreeText({ value: '', onAnswerChange });
    expect(onAnswerChange).toHaveBeenCalledWith(false);
  });

  it('calls onAnswerChange(true) for non-empty value', () => {
    const onAnswerChange = vi.fn();
    renderFreeText({ value: 'Det er et travelt yrke.', onAnswerChange });
    expect(onAnswerChange).toHaveBeenCalledWith(true);
  });

  it('calls onAnswerChange(false) for whitespace-only value', () => {
    const onAnswerChange = vi.fn();
    renderFreeText({ value: '   ', onAnswerChange });
    expect(onAnswerChange).toHaveBeenCalledWith(false);
  });
});

/* ── reveal states ───────────────────────────────────────────────── */

describe('FreeTextBody — reveal / feedback', () => {
  it('shows sample answer when ok=false in practice mode', () => {
    renderFreeText({
      phase: 'feedback',
      value: 'Jeg er lege.',
      ok: false,
      mode: 'practice',
    });
    expect(screen.getByText('Sample answer')).toBeInTheDocument();
    expect(screen.getByText('Det er et travelt yrke.')).toBeInTheDocument();
  });

  it('does NOT show sample answer when ok=true', () => {
    renderFreeText({
      phase: 'feedback',
      value: 'Det er et travelt yrke.',
      ok: true,
      mode: 'practice',
    });
    expect(screen.queryByText('Sample answer')).not.toBeInTheDocument();
  });

  it('does NOT show sample answer in graded mode (ok=null)', () => {
    renderFreeText({
      phase: 'feedback',
      value: 'Jeg er lege.',
      ok: null,
      mode: 'graded',
    });
    expect(screen.queryByText('Sample answer')).not.toBeInTheDocument();
  });

  it('textarea has error border on wrong answer (practice)', () => {
    renderFreeText({
      phase: 'feedback',
      value: 'Jeg er lege.',
      ok: false,
      mode: 'practice',
    });
    const textarea = screen.getByRole('textbox');
    expect(textarea.getAttribute('style')).toContain('feedback-no-line');
  });

  it('textarea has success border on correct answer (practice)', () => {
    renderFreeText({
      phase: 'feedback',
      value: 'Det er et travelt yrke.',
      ok: true,
      mode: 'practice',
    });
    const textarea = screen.getByRole('textbox');
    expect(textarea.getAttribute('style')).toContain('feedback-ok-line');
  });

  it('textarea keeps default border in answering phase', () => {
    renderFreeText({ value: 'something' });
    const textarea = screen.getByRole('textbox');
    expect(textarea.getAttribute('style')).toContain('ssz-border-default');
  });
});

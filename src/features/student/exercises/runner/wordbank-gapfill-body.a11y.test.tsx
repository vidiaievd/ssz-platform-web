import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { NextIntlClientProvider } from 'next-intl';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import type { StudentProjection } from '@/lib/shared-kernel/wordbank-gapfill';

import { WordBankGapFillBody, type GapFillValue, type GapVerdict } from './wordbank-gapfill-body';

function makeProjection(overrides: Partial<StudentProjection> = {}): StudentProjection {
  return {
    sentences: [
      {
        id: 's1',
        tokens: [
          { kind: 'text', text: 'Jeg' },
          { kind: 'text', text: 'vil' },
          { kind: 'text', text: 'gjerne' },
          { kind: 'gap', gapKey: 's1#3', label: 'G1', before: '', after: '' },
          { kind: 'text', text: 'en' },
          { kind: 'text', text: 'kaffe.' },
        ],
      },
      {
        id: 's2',
        hint: 'Du skal betale nå.',
        tokens: [
          { kind: 'text', text: 'Kan' },
          { kind: 'text', text: 'jeg' },
          { kind: 'text', text: 'få' },
          { kind: 'gap', gapKey: 's2#3', label: 'G2', before: '', after: ',' },
          { kind: 'text', text: 'takk?' },
        ],
      },
    ],
    bank: ['bestille', 'bestilt', 'regning', 'regningen'],
    settings: { allowReuse: false, showBankCount: true, input: 'bank' },
    ...overrides,
  };
}

function Harness({
  projection = makeProjection(),
  results,
  revealed,
}: {
  projection?: StudentProjection;
  results?: Record<string, GapVerdict>;
  revealed?: Record<string, string>;
}) {
  const [value, setValue] = useState<GapFillValue>({});
  return (
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <WordBankGapFillBody
        projection={projection}
        instruction="Fyll inn de manglende ordene."
        value={value}
        onValueChange={setValue}
        onAnswerChange={vi.fn()}
        phase="answering"
        mode="practice"
        accent="var(--ssz-runner-practice)"
        results={results}
        revealed={revealed}
      />
    </NextIntlClientProvider>
  );
}

/**
 * axe against the rendered body. Colour contrast is skipped because jsdom does no
 * layout or cascade — it would report every element as unknown rather than as passing,
 * which is noise, not a result. Contrast is covered by the Storybook a11y addon, which
 * runs in a real browser.
 */
async function violationsIn(container: HTMLElement): Promise<axe.Result[]> {
  const results = await axe.run(container, {
    rules: { 'color-contrast': { enabled: false } },
  });
  return results.violations.filter(
    (violation) => violation.impact === 'serious' || violation.impact === 'critical',
  );
}

describe('WordBankGapFillBody — accessibility (AC-X2)', () => {
  it('has no serious or critical violations while answering', async () => {
    const { container } = render(<Harness />);
    expect(await violationsIn(container)).toEqual([]);
  });

  it('has none after a check either, when the feedback blocks appear', async () => {
    const { container } = render(
      <Harness
        results={{
          's1#3': { correct: false, explanation: 'That is the past participle.' },
          's2#3': { correct: true, explanation: 'A specific bill takes the definite form.' },
        }}
      />,
    );
    expect(await violationsIn(container)).toEqual([]);
  });

  it('has none in free-input mode, where the gaps are text fields', async () => {
    const { container } = render(
      <Harness
        projection={makeProjection({
          bank: null,
          settings: { allowReuse: false, showBankCount: true, input: 'free' },
        })}
      />,
    );
    expect(await violationsIn(container)).toEqual([]);
  });
});

describe('WordBankGapFillBody — keyboard only (AC-X3)', () => {
  it('can be completed without ever using a pointer', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    // Tab through the bank to the first word, and place it with the keyboard.
    await user.tab();
    expect(screen.getByRole('button', { name: 'bestille' })).toHaveFocus();
    await user.keyboard('{Enter}');

    expect(screen.getByRole('button', { name: /^G1:/ })).toHaveAccessibleName('G1: bestille');

    // Reach the second gap and arm it, then reach a word and place it there.
    screen.getByRole('button', { name: /^G2:/ }).focus();
    await user.keyboard(' ');
    screen.getByRole('button', { name: 'regningen' }).focus();
    await user.keyboard('{Enter}');

    expect(screen.getByRole('button', { name: /^G2:/ })).toHaveAccessibleName('G2: regningen');
  });

  it('gives every control a name that says what it is and what state it is in', () => {
    render(<Harness />);

    // A gap announces its label and its content, not "button".
    expect(screen.getByRole('button', { name: 'G1: empty gap' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Word bank' })).toBeInTheDocument();
  });

  it('announces the running word count politely rather than interrupting', () => {
    render(<Harness />);
    expect(screen.getByText('4 left')).toHaveAttribute('aria-live', 'polite');
  });
});

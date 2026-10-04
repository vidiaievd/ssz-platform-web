import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import type { HighlightInTextContent } from '@/lib/shared-kernel/highlight-in-text';
import {
  exercise,
  question,
  SAMPLE_TEXT,
  spanAt,
} from '@/lib/shared-kernel/highlight-in-text/fixtures.test-support';

import { StepFeedback } from './step-feedback';

function Harness({
  initial,
  spy,
}: {
  initial: HighlightInTextContent;
  spy: (ex: HighlightInTextContent) => void;
}) {
  const [ex, setEx] = useState(initial);
  return (
    <StepFeedback
      exercise={ex}
      onChange={(next) => {
        spy(next);
        setEx(next);
      }}
    />
  );
}

function draw(initial: HighlightInTextContent) {
  const spy = vi.fn();
  const view = render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <Harness initial={initial} spy={spy} />
    </NextIntlClientProvider>,
  );
  return { ...view, last: () => spy.mock.calls.at(-1)?.[0] as HighlightInTextContent };
}

const reiste = spanAt(SAMPLE_TEXT, 'reiste', 1, 'a', 'reise → reiste');
const gikk = spanAt(SAMPLE_TEXT, 'gikk', 1, 'b');

describe('StepFeedback', () => {
  it('counts the marks with a reason and says how many still say nothing', () => {
    draw(exercise({ questions: [question('q1', { spans: [reiste, gikk] })] }));
    expect(screen.getByText('marks with a reason', { selector: 'p' })).toBeInTheDocument();
    expect(screen.getByText(/1 of them still says only “correct”\./)).toBeInTheDocument();
  });

  it('says every mark explains itself when all have a reason', () => {
    draw(exercise());
    expect(
      screen.getByText('Every mark explains itself when the answers are shown.'),
    ).toBeInTheDocument();
  });

  it('marks the missed-mark line required on a question with marks (AC-A5)', () => {
    draw(exercise({ questions: [question('q1', { spans: [reiste], missHint: '' })] }));
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Required — without it a missed mark says nothing.',
    );
    expect(screen.getByLabelText(/When they missed one/)).toHaveAttribute('aria-invalid', 'true');
  });

  it('does not raise it on a question with nothing marked yet (Q6-A)', () => {
    draw(exercise({ questions: [question('q1', { spans: [], missHint: '' })] }));
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('writes both lines and a per-mark reason into the question', async () => {
    const { last } = draw(
      exercise({
        questions: [question('q1', { spans: [reiste, gikk], missHint: '', fpHint: '' })],
      }),
    );
    await userEvent.type(screen.getByLabelText(/When they missed one/), 'Se etter -te.');
    await userEvent.type(screen.getByLabelText('When they marked something extra'), 'Felle.');
    await userEvent.type(screen.getByRole('textbox', { name: 'Reason for mark 2 «gikk»' }), 'gå');
    const q = last().questions[0]!;
    expect(q.missHint).toBe('Se etter -te.');
    expect(q.fpHint).toBe('Felle.');
    expect(q.spans.find((s) => s.id === 'b')!.why).toBe('gå');
  });

  it('narrows the page to what is still empty', async () => {
    draw(
      exercise({
        questions: [
          question('q1', { prompt: 'Done one', spans: [reiste] }),
          question('q2', { prompt: 'Open one', spans: [reiste, gikk], fpHint: '' }),
        ],
      }),
    );
    await userEvent.click(screen.getByRole('checkbox', { name: 'Only what is still empty' }));
    expect(screen.queryByRole('heading', { name: 'Done one' })).toBeNull();
    expect(screen.getByRole('heading', { name: 'Open one' })).toBeInTheDocument();
    // Only the reason still blank is listed.
    expect(screen.queryByRole('textbox', { name: /Reason for mark 1/ })).toBeNull();
    expect(screen.getByRole('textbox', { name: /Reason for mark 2/ })).toBeInTheDocument();
  });
});

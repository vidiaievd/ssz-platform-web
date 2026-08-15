import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import {
  DEFAULT_AI,
  DEFAULT_CHECK,
  DEFAULT_FLOW,
  type Translate,
} from '@/lib/shared-kernel/translate';

import { StepFlow } from './step-flow';
import { makeDoc, makeItem } from './test-doc';

function renderStep(exercise: Translate = makeDoc(), onChange = vi.fn()) {
  render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <StepFlow exercise={exercise} onChange={onChange} />
    </NextIntlClientProvider>,
  );
  return { onChange, user: userEvent.setup() };
}

describe('StepFlow', () => {
  /** The stage that does not exist has to say so wherever it is drawn. */
  it('draws the AI stage as not connected', () => {
    renderStep();

    expect(screen.getByText('AI pre-check')).toBeInTheDocument();
    expect(screen.getAllByText('not connected').length).toBeGreaterThan(0);
  });

  it('reads the first stage off the check settings rather than restating them', () => {
    renderStep(makeDoc({ check: { ...DEFAULT_CHECK, on: false } }));

    expect(screen.getByText('Off — nothing is judged before you see it.')).toBeInTheDocument();
  });

  it('says the check approves nothing when the author has turned approving off', () => {
    renderStep(makeDoc({ check: { ...DEFAULT_CHECK, exactPass: false } }));

    expect(
      screen.getByText(
        'Diffs against your key and sorts the rest — approving nothing, by your setting.',
      ),
    ).toBeInTheDocument();
  });

  it('hides the AI aspects until the stage is switched on', async () => {
    const { onChange, user } = renderStep(makeDoc({ ai: { ...DEFAULT_AI, on: false } }));

    expect(screen.queryByText('Word order')).not.toBeInTheDocument();

    await user.click(screen.getByRole('switch', { name: /AI pre-check on/ }));
    expect((onChange.mock.calls[0]![0] as Translate).ai.on).toBe(true);
  });

  it('writes an AI aspect into the document that carries it', async () => {
    const { onChange, user } = renderStep();

    await user.click(screen.getByRole('checkbox', { name: /Register/ }));

    expect((onChange.mock.calls[0]![0] as Translate).ai.checks.register).toBe(true);
  });

  /** A switch for glosses nobody wrote is a switch with nothing behind it. */
  it('makes the gloss switch inert while no sentence has a gloss, and says why', async () => {
    renderStep();

    expect(
      screen.getByText('No glosses written yet — add them to a sentence in step 2.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: /Show the word explanations/ })).toBeDisabled();
  });

  it('lets the glosses be shown once a sentence has one', () => {
    renderStep(makeDoc({ items: [makeItem({ gloss: [{ w: 'allerede', t: 'nå' }] })] }));

    expect(screen.getByRole('switch', { name: /Show the word explanations/ })).toBeEnabled();
  });

  it('spends the self-check budget the runner and the server both read', async () => {
    const { onChange, user } = renderStep(makeDoc({ flow: { ...DEFAULT_FLOW, selfCheck: 2 } }));

    await user.click(screen.getByRole('radio', { name: 'off' }));

    expect((onChange.mock.calls[0]![0] as Translate).flow.selfCheck).toBe(0);
  });

  it('explains what showing the key right after handing in means for the student', () => {
    renderStep(makeDoc({ flow: { ...DEFAULT_FLOW, showRefs: 'afterSubmit' } }));

    expect(
      screen.getByText('The student sees the key while the answer waits in your queue.'),
    ).toBeInTheDocument();
  });
});

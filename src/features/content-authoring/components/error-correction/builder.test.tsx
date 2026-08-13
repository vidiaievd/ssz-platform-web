import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import {
  DEFAULT_AI,
  DEFAULT_CHECK,
  DEFAULT_FLOW,
  DEFAULT_HINTS,
  type ErrorCorrection,
} from '@/lib/shared-kernel/error-correction';

vi.mock('../../actions/error-correction', () => ({ saveErrorCorrectionAction: vi.fn() }));

const { ErrorCorrectionBuilder } = await import('./builder');
const { saveErrorCorrectionAction } = await import('../../actions/error-correction');

const LOADED_AT = '2026-08-12T10:00:00.000Z';

function doc(overrides: Partial<ErrorCorrection> = {}): ErrorCorrection {
  return {
    id: 'ex-1',
    type: 'error_correction',
    moduleId: 'module-1',
    title: '',
    instructions: 'Finn feilen i hver setning.',
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
    updatedAt: LOADED_AT,
    ...overrides,
  };
}

function renderBuilder(exercise: ErrorCorrection = doc()) {
  render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <ErrorCorrectionBuilder exerciseId="ex-1" containerId="module-1" initialExercise={exercise} />
    </NextIntlClientProvider>,
  );
  return { user: userEvent.setup() };
}

// Real timers: the debounce is 800ms and the assertions wait it out. Fake timers here
// fight `waitFor`, which runs timers of its own.
const DEBOUNCED = { timeout: 3_000 };

beforeEach(() => {
  vi.mocked(saveErrorCorrectionAction).mockResolvedValue({
    ok: true,
    value: { status: 'saved', updatedAt: '2026-08-12T10:00:05.000Z' },
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('ErrorCorrectionBuilder', () => {
  it('saves an edit without a save button, and reports it', async () => {
    const { user } = renderBuilder();

    await user.type(screen.getByLabelText('Task line'), '!');
    expect(saveErrorCorrectionAction).not.toHaveBeenCalled();

    await waitFor(() => expect(saveErrorCorrectionAction).toHaveBeenCalledTimes(1), DEBOUNCED);
    const [, , input] = vi.mocked(saveErrorCorrectionAction).mock.calls[0]!;
    expect(input.expectedUpdatedAt).toBe(LOADED_AT);
    expect(input.instructions).toBe('Finn feilen i hver setning.!');
    // The answer key never travels in `content`: that column is what the student is sent.
    expect(JSON.stringify(input.content)).not.toContain('gikk jeg');
    expect(input.expectedAnswers.items['i1']?.ref).toBe('I går gikk jeg på kino.');
    await waitFor(() => expect(screen.getByText(/^Saved at/)).toBeInTheDocument(), DEBOUNCED);
  });

  it('carries the new token into the next save', async () => {
    const { user } = renderBuilder();

    await user.type(screen.getByLabelText('Task line'), 'a');
    await waitFor(() => expect(saveErrorCorrectionAction).toHaveBeenCalledTimes(1), DEBOUNCED);

    await user.type(screen.getByLabelText('Task line'), 'b');
    await waitFor(() => expect(saveErrorCorrectionAction).toHaveBeenCalledTimes(2), DEBOUNCED);
    const [, , second] = vi.mocked(saveErrorCorrectionAction).mock.calls[1]!;
    expect(second.expectedUpdatedAt).toBe('2026-08-12T10:00:05.000Z');
  });

  it('stops on a conflict and offers to write over the version that won', async () => {
    vi.mocked(saveErrorCorrectionAction).mockResolvedValueOnce({
      ok: true,
      value: { status: 'conflict', currentUpdatedAt: '2026-08-12T11:00:00.000Z' },
    });
    const { user } = renderBuilder();

    await user.type(screen.getByLabelText('Task line'), 'a');
    await waitFor(
      () => expect(screen.getByText(/Someone else saved/)).toBeInTheDocument(),
      DEBOUNCED,
    );

    await user.click(screen.getByRole('button', { name: /Save mine anyway/ }));
    await waitFor(() => expect(saveErrorCorrectionAction).toHaveBeenCalledTimes(2), DEBOUNCED);
    const [, , retried] = vi.mocked(saveErrorCorrectionAction).mock.calls[1]!;
    expect(retried.expectedUpdatedAt).toBe('2026-08-12T11:00:00.000Z');
  });

  it('marks the step that holds a blocker, and reaches it in one click', async () => {
    const { user } = renderBuilder(
      doc({ items: [{ id: 'i1', wrong: 'I går jeg gikk.', ref: '', alts: [], meta: {} }] }),
    );

    const mistakes = screen.getByRole('tab', { name: /The mistakes/ });
    expect(within(mistakes).getByText('1 problem')).toBeInTheDocument();

    await user.click(mistakes);
    expect(mistakes).toHaveAttribute('aria-selected', 'true');
  });

  it('blocks the gate while a blocker stands, and links to the step that owns it', async () => {
    const { user } = renderBuilder(
      doc({ items: [{ id: 'i1', wrong: 'I går jeg gikk.', ref: '', alts: [], meta: {} }] }),
    );

    await user.click(screen.getAllByRole('button', { name: 'Done' })[0]!);

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText(/Sentence 1: no answer key/)).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: /Fix 1 problem first/ })).toBeDisabled();

    await user.click(within(dialog).getByRole('button', { name: /no answer key/ }));
    expect(screen.getByRole('tab', { name: /The mistakes/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  it('reaches every step of the rail, each with its own screen', async () => {
    const { user } = renderBuilder();

    for (const [step, heading] of [
      ['The mistakes', 'The sentences and the answer key'],
      ['Hints & check', 'What does the student know, and what does the machine accept?'],
      ['Flow', 'The road from handing in to a mark'],
      ['Format', 'What kind of correction is this?'],
    ] as const) {
      await user.click(screen.getByRole('tab', { name: new RegExp(step) }));
      expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument();
    }
  });

  it('says nothing about the AI stage, which has no controls yet', async () => {
    // `AI_UNLIMITED_BEFORE_SUBMIT`: the AI comment is shown before submitting and there
    // are no self-checks. A true remark — and unactionable until the block is built.
    const { user } = renderBuilder(doc({ flow: { ...DEFAULT_FLOW, selfCheck: 0 } }));

    await user.click(screen.getAllByRole('button', { name: 'Done' })[0]!);

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).queryByText(/AI/)).not.toBeInTheDocument();
    expect(within(dialog).getByText(/ready to assign/)).toBeInTheDocument();
  });
});

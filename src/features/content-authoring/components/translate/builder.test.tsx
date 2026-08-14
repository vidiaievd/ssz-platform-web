import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import type { Translate } from '@/lib/shared-kernel/translate';

vi.mock('../../actions/translate', () => ({ saveTranslateAction: vi.fn() }));

const { TranslateBuilder } = await import('./builder');
const { saveTranslateAction } = await import('../../actions/translate');
const { makeDoc, makeItem } = await import('./test-doc');

const LOADED_AT = '2026-08-14T10:00:00.000Z';

function renderBuilder(exercise: Translate = makeDoc()) {
  render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <TranslateBuilder exerciseId="ex-1" containerId="module-1" initialExercise={exercise} />
    </NextIntlClientProvider>,
  );
  return { user: userEvent.setup() };
}

// Real timers: the debounce is 800ms and the assertions wait it out. Fake timers here
// fight `waitFor`, which runs timers of its own.
const DEBOUNCED = { timeout: 3_000 };

beforeEach(() => {
  vi.mocked(saveTranslateAction).mockResolvedValue({
    ok: true,
    value: { status: 'saved', updatedAt: '2026-08-14T10:00:05.000Z' },
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('TranslateBuilder', () => {
  it('saves an edit without a save button, and keeps the key out of the student column', async () => {
    const { user } = renderBuilder();

    await user.type(screen.getByLabelText('Instruction'), '!');
    expect(saveTranslateAction).not.toHaveBeenCalled();

    await waitFor(() => expect(saveTranslateAction).toHaveBeenCalledTimes(1), DEBOUNCED);
    const [, , input] = vi.mocked(saveTranslateAction).mock.calls[0]!;
    expect(input.expectedUpdatedAt).toBe(LOADED_AT);
    expect(input.instructions).toBe('Oversett setningene til norsk.!');
    // `content` is the column the student is sent, so no accepted translation may be in it.
    expect(JSON.stringify(input.content)).not.toContain('har bodd');
    expect(input.expectedAnswers.items['i1']?.refs).toEqual(['Jeg har bodd i Tromsø i tre år.']);
    await waitFor(() => expect(screen.getByText(/^Saved at/)).toBeInTheDocument(), DEBOUNCED);
  });

  it('carries the new token into the next save', async () => {
    const { user } = renderBuilder();

    await user.type(screen.getByLabelText('Instruction'), 'a');
    await waitFor(() => expect(saveTranslateAction).toHaveBeenCalledTimes(1), DEBOUNCED);

    await user.type(screen.getByLabelText('Instruction'), 'b');
    await waitFor(() => expect(saveTranslateAction).toHaveBeenCalledTimes(2), DEBOUNCED);
    const [, , second] = vi.mocked(saveTranslateAction).mock.calls[1]!;
    expect(second.expectedUpdatedAt).toBe('2026-08-14T10:00:05.000Z');
  });

  it('stops on a conflict and offers to write over the version that won', async () => {
    vi.mocked(saveTranslateAction).mockResolvedValueOnce({
      ok: true,
      value: { status: 'conflict', currentUpdatedAt: '2026-08-14T11:00:00.000Z' },
    });
    const { user } = renderBuilder();

    await user.type(screen.getByLabelText('Instruction'), 'a');
    await waitFor(
      () => expect(screen.getByText(/Someone else saved/)).toBeInTheDocument(),
      DEBOUNCED,
    );

    await user.click(screen.getByRole('button', { name: /Save mine anyway/ }));
    await waitFor(() => expect(saveTranslateAction).toHaveBeenCalledTimes(2), DEBOUNCED);
    const [, , retried] = vi.mocked(saveTranslateAction).mock.calls[1]!;
    expect(retried.expectedUpdatedAt).toBe('2026-08-14T11:00:00.000Z');
  });

  it('marks the step that holds a blocker, and reaches it in one click', async () => {
    const { user } = renderBuilder(makeDoc({ items: [makeItem({ refs: [''] })] }));

    const sentences = screen.getByRole('tab', { name: /The sentences/ });
    expect(within(sentences).getByText('1 problem')).toBeInTheDocument();

    await user.click(sentences);
    expect(sentences).toHaveAttribute('aria-selected', 'true');
  });

  it('blocks the gate while a blocker stands, and links to the step that owns it', async () => {
    const { user } = renderBuilder(makeDoc({ items: [makeItem({ refs: [''] })] }));

    await user.click(screen.getAllByRole('button', { name: 'Done' })[0]!);

    const dialog = screen.getByRole('dialog');
    expect(
      within(dialog).getByText('Sentence 1 has no accepted translation.'),
    ).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: /Fix 1 problem first/ })).toBeDisabled();

    await user.click(within(dialog).getByRole('button', { name: /no accepted translation/ }));
    expect(screen.getByRole('tab', { name: /The sentences/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  /**
   * Steps 3 and 4 have no controls yet. Their problems are still reported — a blocker the
   * author cannot see is one they cannot ask about — but without a link to a screen that
   * does not exist.
   */
  it('reports a problem from an unbuilt step without offering to travel to it', async () => {
    const { user } = renderBuilder(
      makeDoc({ items: [makeItem({ forbid: [{ text: 'har bodd' }] })] }),
    );

    await user.click(screen.getAllByRole('button', { name: 'Done' })[0]!);

    const dialog = screen.getByRole('dialog');
    expect(
      within(dialog).getByText(
        'Sentence 1: «har bodd» is forbidden, but your own key contains it.',
      ),
    ).toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: /is forbidden/ })).not.toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: /Fix 1 problem first/ })).toBeDisabled();
  });

  it('reaches both built steps of the rail, each with its own screen', async () => {
    const { user } = renderBuilder();

    for (const [step, heading] of [
      ['The sentences', 'The sentences and their translations'],
      ['Direction', 'Which way round?'],
    ] as const) {
      await user.click(screen.getByRole('tab', { name: new RegExp(step) }));
      expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument();
    }
  });
});

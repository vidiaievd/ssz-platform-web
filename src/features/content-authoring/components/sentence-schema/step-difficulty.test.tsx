import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import { DEFAULT_SETTINGS, type SentenceSchemaContent } from '@/lib/shared-kernel/sentence-schema';
import { content, row } from '@/lib/shared-kernel/sentence-schema/fixtures.test-support';

import { StepDifficulty } from './step-difficulty';
import type { SentenceSchemaDocument } from './edits';

function doc(overrides: Partial<SentenceSchemaContent> = {}): SentenceSchemaDocument {
  return { updatedAt: '2026-08-26T10:00:00.000Z', ...content(overrides) };
}

/** The document as step 1 leaves it when the author picks the sequence-only mode. */
function seqDoc(overrides: Partial<SentenceSchemaContent> = {}): SentenceSchemaDocument {
  const base = doc(overrides);
  return { ...base, settings: { ...base.settings, orderOnly: true } };
}

function Harness({
  initial,
  onChange,
}: {
  initial: SentenceSchemaDocument;
  onChange?: (next: SentenceSchemaDocument) => void;
}) {
  const [exercise, setExercise] = useState(initial);

  return (
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <StepDifficulty
        exercise={exercise}
        onChange={(next) => {
          onChange?.(next);
          setExercise(next);
        }}
      />
    </NextIntlClientProvider>
  );
}

function renderStep(initial: SentenceSchemaDocument = doc()) {
  const onChange = vi.fn();
  render(<Harness initial={initial} onChange={onChange} />);
  return { user: userEvent.setup(), onChange };
}

describe('StepDifficulty', () => {
  it('lists the nine switches from the strongest support to the strictest', () => {
    renderStep();

    // Nine, not ten: the mode moved to step 1, where it decides whether this screen's
    // field switches apply at all (plan 52, Q8).
    expect(screen.getAllByRole('switch')).toHaveLength(9);
    expect(
      screen.getAllByRole('switch').map((el) => el.closest('label')!.textContent!.split('Off')[0]),
    ).toEqual([
      expect.stringContaining('Show field names'),
      expect.stringContaining('Show field hints'),
      expect.stringContaining('Show how many chunks per field'),
      expect.stringContaining('Pre-place the first chunk'),
      expect.stringContaining('Extra pieces in the bank'),
      expect.stringContaining('Shuffle the bank'),
      expect.stringContaining('Mark each field on check'),
      expect.stringContaining('Show the rule after the second mistake'),
      expect.stringContaining('Order inside a field counts'),
    ]);
  });

  it('no longer carries the mode switch — it belongs to step 1 now', () => {
    renderStep();

    expect(screen.queryByRole('switch', { name: /Word order only/ })).not.toBeInTheDocument();
  });

  it('has no switch for markEmpty — the model carries it, the runner does not', () => {
    renderStep();

    expect(screen.queryByText(/tick fields that stay empty/i)).not.toBeInTheDocument();
  });

  it('writes the pre-fill mode rather than a boolean', async () => {
    const { user, onChange } = renderStep();

    await user.click(screen.getByRole('switch', { name: /Pre-place the first chunk/ }));

    expect((onChange.mock.lastCall![0] as SentenceSchemaDocument).settings.prefill).toBe('first');
  });

  it('writes the order mode rather than a boolean', async () => {
    const { user, onChange } = renderStep();

    await user.click(screen.getByRole('switch', { name: /Order inside a field counts/ }));

    expect((onChange.mock.lastCall![0] as SentenceSchemaDocument).settings.order).toBe('loose');
  });

  it('leaves the other eight settings alone when one is flipped', async () => {
    const { user, onChange } = renderStep();

    await user.click(screen.getByRole('switch', { name: /Shuffle the bank/ }));

    expect((onChange.mock.lastCall![0] as SentenceSchemaDocument).settings).toEqual({
      ...DEFAULT_SETTINGS,
      shuffle: false,
    });
  });

  it('says beside the switch when extras are on and no sentence has any', () => {
    renderStep(doc({ rows: [row({ extras: [] })] }));

    expect(
      screen.getByText('Extra pieces are switched on, but no sentence has any.'),
    ).toBeInTheDocument();
  });

  it('says nothing once a sentence has an extra', () => {
    renderStep(doc({ rows: [row({ extras: [{ id: 'x1', text: 'boken' }] })] }));

    expect(screen.queryByText(/Extra pieces are switched on/)).not.toBeInTheDocument();
  });
});

describe('StepDifficulty · word order only', () => {
  it('hides the five field switches and says they are coming back', () => {
    renderStep(seqDoc());

    /*
      Hidden, not inert — reversing the earlier decision (plan 52, Q8). The cause is now
      visible on step 1, and the worry the old comment named is answered by the line
      below: the values are kept, and the author is told so.
    */
    expect(screen.queryByRole('switch', { name: /Show field names/ })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('switch', { name: /Order inside a field counts/ }),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/five field settings are hidden/i)).toBeInTheDocument();
  });

  it('leaves the switches that still mean something alone', () => {
    renderStep(seqDoc());

    // The bank is still a bank: distractors, shuffling and the escalating hint all apply.
    expect(screen.getByRole('switch', { name: /Extra pieces in the bank/ })).toBeEnabled();
    expect(screen.getByRole('switch', { name: /Shuffle the bank/ })).toBeEnabled();
    expect(screen.getByRole('switch', { name: /Show the rule after/ })).toBeEnabled();
  });

  it('keeps the hidden values in the document, so switching back restores them', async () => {
    const { user, onChange } = renderStep(seqDoc());

    await user.click(screen.getByRole('switch', { name: /Shuffle the bank/ }));

    const next = onChange.mock.lastCall![0] as SentenceSchemaDocument;
    expect(next.settings.labels).toBe(DEFAULT_SETTINGS.labels);
    expect(next.settings.perField).toBe(DEFAULT_SETTINGS.perField);
    expect(next.settings.order).toBe(DEFAULT_SETTINGS.order);
  });
});

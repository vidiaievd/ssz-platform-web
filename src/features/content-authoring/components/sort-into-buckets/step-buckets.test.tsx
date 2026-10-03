import { useState } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import { emptyContent, type SortIntoBucketsContent } from '@/lib/shared-kernel/sort-into-buckets';
import {
  EI,
  EN,
  ET,
  exercise,
  item,
} from '@/lib/shared-kernel/sort-into-buckets/fixtures.test-support';

import { StepBuckets } from './step-buckets';

interface Document extends SortIntoBucketsContent {
  updatedAt: string;
}

const doc = (content: SortIntoBucketsContent): Document => ({
  updatedAt: '2026-10-03T10:00:00.000Z',
  ...content,
});

/** Holds the document the way the builder does, and lets a test read what it became. */
function renderStep(initial: Document, language = 'nb') {
  const seen: { current: Document } = { current: initial };

  function Harness() {
    const [ex, setEx] = useState(initial);
    return (
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <StepBuckets
          exercise={ex}
          language={language}
          onChange={(next) => {
            seen.current = next;
            setEx(next);
          }}
        />
      </NextIntlClientProvider>
    );
  }

  const view = render(<Harness />);
  return { user: userEvent.setup(), seen, ...view };
}

const labelInput = (n: number) => screen.getByRole('textbox', { name: `Label of bucket ${n}` });
const remove = (n: number) => screen.getByRole('button', { name: `Delete bucket ${n}` });
const add = () => screen.getByRole('button', { name: 'Add a bucket' });

describe('StepBuckets', () => {
  it('opens on two empty buckets with «Add a bucket» enabled and no finding shouting (AC-B1)', () => {
    renderStep(doc(emptyContent()));

    expect(labelInput(1)).toHaveValue('');
    expect(labelInput(2)).toHaveValue('');
    expect(add()).toBeEnabled();
    // The scaffold carries blockers from the start; an untouched step does not draw them.
    expect(screen.queryByText('This bucket needs a label.')).not.toBeInTheDocument();
  });

  it('disables «Add a bucket» at five, refusal bucket included, and says why (AC-B2)', () => {
    renderStep(
      doc(
        exercise({
          buckets: [EN, EI, ET, { id: 'b-4', label: 'x', rule: '' }],
          useNone: true,
          noneLabel: 'Ingen',
        }),
      ),
    );

    expect(add()).toBeDisabled();
    expect(screen.getByText('Five is the most, the refusal bucket included.')).toBeInTheDocument();
  });

  it('disables both delete buttons at two buckets (AC-B3)', () => {
    renderStep(doc(exercise({ buckets: [EN, EI] })));

    expect(remove(1)).toBeDisabled();
    expect(remove(2)).toBeDisabled();
  });

  it('keeps the items of a deleted bucket, unassigned, and drops it from `also` (AC-B4)', async () => {
    const { user, seen } = renderStep(
      doc(
        exercise({
          items: [
            item('i1', 'bil', EN.id),
            item('i2', 'bok', EI.id, { also: [EN.id] }),
            item('i3', 'hus', ET.id),
          ],
          fb: { i3: { def: 'x', ov: { [EN.id]: 'why not en' } } },
        }),
      ),
    );

    await user.click(remove(1));

    const next = seen.current;
    expect(next.buckets.map((b) => b.id)).toEqual([EI.id, ET.id]);
    expect(next.items.map((i) => i.id)).toEqual(['i1', 'i2', 'i3']);
    expect(next.items[0]?.bucketId).toBeNull();
    expect(next.items[1]?.also).toEqual([]);
    expect(next.fb['i3']?.ov).toEqual({});
    // The extras of the builder's document survive the edit.
    expect(next.updatedAt).toBe('2026-10-03T10:00:00.000Z');
  });

  it('raises a blocker when two buckets share a label (AC-B5)', () => {
    renderStep(doc(exercise({ buckets: [EN, { ...EI, label: ' EN ' }] })));

    expect(screen.getByText('Another bucket has the same label.')).toBeInTheDocument();
    expect(labelInput(2)).toHaveAttribute('aria-invalid', 'true');
  });

  it('says how many items the refusal bucket holds, and unassigns them when it goes (AC-B6)', async () => {
    const { user, seen } = renderStep(
      doc(
        exercise({
          useNone: true,
          items: [item('i1', 'bil', EN.id), item('i2', 'ting', 'none'), item('i3', 'sak', 'none')],
        }),
      ),
    );

    expect(screen.getByText(/2 items sit in it/)).toBeInTheDocument();

    await user.click(screen.getByRole('switch', { name: 'Offer a refusal bucket' }));

    const next = seen.current;
    expect(next.useNone).toBe(false);
    // Unassigned, not deleted.
    expect(next.items.map((i) => [i.id, i.bucketId])).toEqual([
      ['i1', EN.id],
      ['i2', null],
      ['i3', null],
    ]);
  });

  it('will not switch the refusal bucket on when five authored buckets leave no room', () => {
    renderStep(
      doc(
        exercise({
          buckets: [
            EN,
            EI,
            ET,
            { id: 'b-4', label: 'x', rule: '' },
            { id: 'b-5', label: 'y', rule: '' },
          ],
        }),
      ),
    );

    expect(screen.getByRole('switch', { name: 'Offer a refusal bucket' })).toBeDisabled();
  });

  it('edits the label and the rule of a bucket without touching its id', async () => {
    const { user, seen } = renderStep(doc(exercise()));

    await user.type(labelInput(1), 'x');
    await user.type(screen.getByRole('textbox', { name: 'Rule of bucket 1' }), '!');

    expect(seen.current.buckets[0]).toMatchObject({ id: EN.id, label: 'enx', rule: `${EN.rule}!` });
  });

  describe('starter sets (AC-X7)', () => {
    it("offers the course language's sets and replaces the buckets with one", async () => {
      const { user, seen } = renderStep(doc(exercise()), 'nb');

      await user.click(screen.getByRole('button', { name: 'at · å' }));

      expect(seen.current.buckets.map((b) => b.label)).toEqual(['at', 'å']);
      // The items stay, and come back unassigned.
      expect(seen.current.items.every((i) => i.bucketId === null)).toBe(true);
      expect(screen.getByRole('button', { name: 'at · å' })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
    });

    it('offers none for a language with no pack, rather than a guess', () => {
      renderStep(doc(exercise()), 'xx');

      expect(screen.queryByText('Start from a set')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /·/ })).not.toBeInTheDocument();
    });
  });

  it('draws the findings of a started step by name (AC-B5, B6)', () => {
    renderStep(doc(exercise({ buckets: [{ ...EN, label: '' }, EI], title: 'x' })));

    const row = labelInput(1).closest('div')?.parentElement as HTMLElement;
    expect(within(row).getByText('This bucket needs a label.')).toBeInTheDocument();
    expect(screen.getByText(/Two buckets with a label are the least/)).toBeInTheDocument();
  });

  it('has no serious accessibility violations', async () => {
    const { container } = renderStep(doc(exercise({ useNone: true })));

    const results = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } });
    expect(
      results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical'),
    ).toEqual([]);
  });
});

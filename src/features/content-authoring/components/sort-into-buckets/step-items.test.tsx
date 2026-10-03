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

import { StepItems } from './step-items';

interface Document extends SortIntoBucketsContent {
  updatedAt: string;
}

const doc = (content: SortIntoBucketsContent): Document => ({
  updatedAt: '2026-10-03T10:00:00.000Z',
  ...content,
});

/** Holds the document the way the builder does, and lets a test read what it became. */
function renderStep(initial: Document) {
  const seen: { current: Document } = { current: initial };

  function Harness() {
    const [ex, setEx] = useState(initial);
    return (
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <StepItems
          exercise={ex}
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

/** The pill of one bucket in one item's picker. */
const pill = (itemNumber: number, label: string) =>
  within(screen.getByRole('group', { name: `Bucket of item ${itemNumber}` })).getByRole('button', {
    name: label,
  });

describe('StepItems', () => {
  it('assigns an item to a bucket by its pill, and takes it back on a second click (AC-I1)', async () => {
    const { user, seen } = renderStep(doc(exercise({ items: [item('i1', 'bil', null)] })));

    await user.click(pill(1, 'en'));
    expect(seen.current.items[0]?.bucketId).toBe(EN.id);
    expect(pill(1, 'en')).toHaveAttribute('aria-pressed', 'true');

    await user.click(pill(1, 'en'));
    expect(seen.current.items[0]?.bucketId).toBeNull();
  });

  it('removes a new primary bucket from `also`, so none is accepted twice (AC-I2)', async () => {
    const { user, seen } = renderStep(
      doc(exercise({ items: [item('i1', 'bok', EI.id, { also: [EN.id] })] })),
    );

    await user.click(pill(1, 'en'));

    expect(seen.current.items[0]).toMatchObject({ bucketId: EN.id, also: [] });
  });

  it('offers «Also accepted in» for the other buckets only, once there is a main one', async () => {
    const { user, seen } = renderStep(
      doc(exercise({ items: [item('i1', 'bok', EI.id), item('i2', 'ting', null)] })),
    );

    const [first, second] = screen.getAllByRole('button', { name: /^Details of item/ });
    await user.click(first as HTMLElement);
    const also = screen.getByRole('group', { name: 'Also accepted in' });
    expect(within(also).queryByRole('button', { name: 'ei' })).not.toBeInTheDocument();

    await user.click(within(also).getByRole('button', { name: 'en' }));
    expect(seen.current.items[0]?.also).toEqual([EN.id]);

    await user.click(second as HTMLElement);
    expect(screen.getByText('Choose the main bucket first.')).toBeInTheDocument();
  });

  it('writes «Why it belongs there» to the item', async () => {
    const { user, seen } = renderStep(
      doc(exercise({ items: [item('i1', 'bil', EN.id, { why: '' })] })),
    );

    await user.click(screen.getByRole('button', { name: 'Details of item 1' }));
    await user.type(screen.getByRole('textbox', { name: 'Why it belongs there' }), 'masculine');

    expect(seen.current.items[0]?.why).toBe('masculine');
  });

  it('deletes an item together with its explanation (AC-I8)', async () => {
    const { user, seen } = renderStep(doc(exercise()));
    expect(seen.current.fb['i1']).toBeDefined();

    await user.click(screen.getByRole('button', { name: 'Delete item 1' }));

    expect(seen.current.items.map((i) => i.id)).not.toContain('i1');
    expect(seen.current.fb['i1']).toBeUndefined();
    expect(seen.current.fb['i2']).toBeDefined();
  });

  it('adds an item', async () => {
    const { user, seen } = renderStep(doc(exercise()));

    await user.click(screen.getByRole('button', { name: 'Add an item' }));

    expect(seen.current.items).toHaveLength(7);
  });

  describe('the balance meter and its findings', () => {
    it('outlines a bucket with no item and blocks on it (AC-I5)', () => {
      renderStep(doc(exercise({ items: exercise().items.filter((i) => i.bucketId !== ET.id) })));

      const bar = screen.getByLabelText('et: 0');
      expect(bar.className).toContain('outline-error');
      expect(screen.getByText(/No item belongs in this bucket/)).toBeInTheDocument();
    });

    it('warns, and only warns, when one bucket holds over 60% of six or more items (AC-I6)', () => {
      renderStep(
        doc(
          exercise({
            items: [
              item('i1', 'a', EN.id),
              item('i2', 'b', EN.id),
              item('i3', 'c', EN.id),
              item('i4', 'd', EN.id),
              item('i5', 'e', EI.id),
              item('i6', 'f', ET.id),
            ],
          }),
        ),
      );

      const finding = screen.getByText(/of the items sit in this bucket/);
      expect(finding).toHaveTextContent('67%');
      // A warning is amber and carries an icon; a blocker would be the error colour.
      expect(finding.className).toContain('text-warning-700');
    });

    it('blocks on fewer than four ready items (AC-I7)', () => {
      renderStep(doc(exercise({ items: [item('i1', 'bil', EN.id), item('i2', 'bok', EI.id)] })));

      const finding = screen.getByText(/at least four finished items — there are 2/);
      expect(finding.className).toContain('text-error');
    });

    it('names an unassigned item under its own row', () => {
      renderStep(doc(exercise({ items: [...exercise().items, item('i7', 'ting', null)] })));

      const row = screen.getByRole('textbox', { name: 'Text of item 7' }).closest('div')
        ?.parentElement as HTMLElement;
      expect(within(row).getByText('Choose the bucket this item belongs in.')).toBeInTheDocument();
    });

    it('draws no finding on an untouched step', () => {
      renderStep(doc(emptyContent()));

      expect(screen.queryByText(/finished items/)).not.toBeInTheDocument();
      expect(screen.queryByText(/No item belongs/)).not.toBeInTheDocument();
    });
  });

  describe('paste a list (AC-I4)', () => {
    it('counts the lines with no matching bucket before the author commits', async () => {
      const { user } = renderStep(doc(exercise()));

      await user.click(screen.getByRole('button', { name: 'Paste a list' }));
      await user.type(
        screen.getByRole('textbox', { name: 'Paste items' }),
        'bil | en{Enter}stol | møbel{Enter}bok, ei',
      );

      expect(screen.getByText('3 items found.')).toBeInTheDocument();
      expect(
        screen.getByText('1 has no matching bucket and will arrive without one.'),
      ).toBeInTheDocument();
    });

    it('adds the items — unmatched ones unassigned — and invents no bucket', async () => {
      const { user, seen } = renderStep(doc(exercise({ items: [] })));

      await user.click(screen.getByRole('button', { name: 'Paste a list' }));
      await user.type(
        screen.getByRole('textbox', { name: 'Paste items' }),
        'bil | en{Enter}stol | møbel',
      );
      await user.click(screen.getByRole('button', { name: 'Add 2 items' }));

      expect(seen.current.items.map((i) => [i.text, i.bucketId])).toEqual([
        ['bil', EN.id],
        ['stol', null],
      ]);
      expect(seen.current.buckets).toHaveLength(3);
    });

    it('replaces the empty items already in the scaffold', async () => {
      const { user, seen } = renderStep(doc(emptyContent()));

      await user.click(screen.getByRole('button', { name: 'Paste a list' }));
      await user.type(screen.getByRole('textbox', { name: 'Paste items' }), 'bil');
      await user.click(screen.getByRole('button', { name: 'Add 1 item' }));

      expect(seen.current.items.map((i) => i.text)).toEqual(['bil']);
    });
  });

  it('has no serious accessibility violations', async () => {
    const { container } = renderStep(doc(exercise()));

    const results = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } });
    expect(
      results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical'),
    ).toEqual([]);
  });
});

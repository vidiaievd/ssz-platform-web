import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import type { SortIntoBucketsContent } from '@/lib/shared-kernel/sort-into-buckets';
import {
  EI,
  EN,
  exercise,
  item,
  settings,
} from '@/lib/shared-kernel/sort-into-buckets/fixtures.test-support';

import { SortIntoBucketsPreview } from './sort-into-buckets-preview';

function renderPreview(ex: SortIntoBucketsContent) {
  const view = render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <SortIntoBucketsPreview exercise={ex} />
    </NextIntlClientProvider>,
  );
  return { user: userEvent.setup(), ...view };
}

const zone = (label: string) => screen.getByRole('group', { name: new RegExp(`^${label},`) });

describe('SortIntoBucketsPreview', () => {
  it('draws the runner body from the projection — tiles and zones, no key (AC-X10)', () => {
    renderPreview(exercise({ settings: settings({ shuffle: false }) }));

    expect(screen.getByRole('button', { name: /^bil/ })).toBeInTheDocument();
    expect(zone('en')).toBeInTheDocument();
    // The rule and the reason are the key; the student has neither before a check.
    expect(screen.queryByText(/Bestemt form -en/)).not.toBeInTheDocument();
    expect(screen.queryByText(/bil — why/)).not.toBeInTheDocument();
  });

  it('says so when no item is finished yet', () => {
    renderPreview(exercise({ items: [item('i1', '', null)] }));

    expect(screen.getByText('Finish some items to see the board.')).toBeInTheDocument();
  });

  it('runs the kernel check: a wrong tile is told what the author wrote for that bucket', async () => {
    const { user } = renderPreview(
      exercise({
        items: [
          item('i1', 'bok', EI.id),
          item('i2', 'bil', EN.id),
          item('i3', 'hus', EN.id),
          item('i4', 'gutt', EN.id),
        ],
        fb: {
          i1: { def: 'default', ov: { [EN.id]: 'Not en: bok is feminine.' } },
          i2: { def: 'x', ov: {} },
          i3: { def: 'x', ov: {} },
          i4: { def: 'x', ov: {} },
        },
        settings: settings({ shuffle: false }),
      }),
    );

    // Tap a tile, then the wrong zone for it.
    await user.click(screen.getByRole('button', { name: /^bok/ }));
    await user.click(zone('en'));
    await user.click(screen.getByRole('button', { name: /^Check/ }));

    expect(await screen.findByText(/Not en: bok is feminine\./)).toBeInTheDocument();
  });
});

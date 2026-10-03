import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import type { Issue } from '@/lib/shared-kernel/sort-into-buckets';
import { EN, exercise } from '@/lib/shared-kernel/sort-into-buckets/fixtures.test-support';

import { useIssueCopy } from './issue-copy';

/** One issue per code — the type is a union, so a missing code here is a type error. */
const ONE_OF_EACH: Record<Issue['code'], Issue> = {
  SB_BUCKETS_TOO_FEW: { code: 'SB_BUCKETS_TOO_FEW', level: 'blocker', step: 1, count: 1 },
  SB_BUCKET_UNLABELLED: {
    code: 'SB_BUCKET_UNLABELLED',
    level: 'blocker',
    step: 1,
    bucketId: EN.id,
  },
  SB_BUCKET_LABEL_DUPLICATE: {
    code: 'SB_BUCKET_LABEL_DUPLICATE',
    level: 'blocker',
    step: 1,
    bucketId: EN.id,
  },
  SB_BUCKETS_TOO_MANY: { code: 'SB_BUCKETS_TOO_MANY', level: 'blocker', step: 1, count: 6 },
  SB_ITEM_UNASSIGNED: { code: 'SB_ITEM_UNASSIGNED', level: 'blocker', step: 2, itemId: 'i2' },
  SB_ITEMS_TOO_FEW: { code: 'SB_ITEMS_TOO_FEW', level: 'blocker', step: 2, count: 3 },
  SB_ITEM_DUPLICATE: { code: 'SB_ITEM_DUPLICATE', level: 'blocker', step: 2, itemId: 'i2' },
  SB_BUCKET_EMPTY: { code: 'SB_BUCKET_EMPTY', level: 'blocker', step: 2, bucketId: EN.id },
  SB_THIN_BUCKETS: {
    code: 'SB_THIN_BUCKETS',
    level: 'warning',
    step: 2,
    bucketId: EN.id,
    count: 1,
  },
  SB_SKEWED: { code: 'SB_SKEWED', level: 'warning', step: 2, bucketId: EN.id, share: 0.67 },
  SB_MULTI_HEAVY: { code: 'SB_MULTI_HEAVY', level: 'warning', step: 2, count: 4, total: 6 },
  SB_ITEM_LONG: { code: 'SB_ITEM_LONG', level: 'warning', step: 2, itemId: 'i2', words: 8 },
  SB_NO_EXPLANATION: { code: 'SB_NO_EXPLANATION', level: 'blocker', step: 3, itemId: 'i2' },
  SB_BUCKET_NO_RULE: { code: 'SB_BUCKET_NO_RULE', level: 'warning', step: 3, bucketId: EN.id },
  SB_COUNTER_ARITHMETIC: { code: 'SB_COUNTER_ARITHMETIC', level: 'warning', step: 4 },
  SB_ONE_SHOT_KEY: { code: 'SB_ONE_SHOT_KEY', level: 'warning', step: 4 },
};

function Lines({ bare }: { bare: boolean }) {
  const describe = useIssueCopy(exercise());
  return (
    <ul>
      {Object.values(ONE_OF_EACH).map((issue) => (
        <li key={issue.code}>{describe(issue, { bare })}</li>
      ))}
    </ul>
  );
}

const draw = (bare: boolean) =>
  render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <Lines bare={bare} />
    </NextIntlClientProvider>,
  );

describe('useIssueCopy', () => {
  it('has words for all sixteen codes, with every parameter filled in', () => {
    draw(false);

    const lines = screen.getAllByRole('listitem').map((li) => li.textContent ?? '');
    expect(lines).toHaveLength(16);
    for (const line of lines) {
      // A missing message reads back as its own key; an unfilled one keeps its braces.
      expect(line).not.toMatch(/SB_|issues\.|\{|\}/);
    }
  });

  it("puts the subject in front of what is wrong, by the item's place in the list", () => {
    draw(false);

    expect(
      screen.getByText('Item 2 — Choose the bucket this item belongs in.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Bucket «en» — This bucket needs a label.')).toBeInTheDocument();
  });

  it('leaves the subject off for a line drawn under that very row', () => {
    draw(true);

    expect(screen.getByText('Choose the bucket this item belongs in.')).toBeInTheDocument();
  });

  it('rounds the share to a whole percent', () => {
    draw(true);

    expect(screen.getByText(/67% of the items/)).toBeInTheDocument();
  });
});

import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import type { ReviewVerdictRecord } from '@/features/review/types';

import { PreviousAttempt } from './previous-attempt';

const BASE: ReviewVerdictRecord = {
  attemptId: 'a0',
  outcome: 'returned',
  at: '2026-10-07T08:54:30.000Z',
  reviewerId: 't1',
  reviewerName: 'Teacher',
  comment: null,
};

function show(verdict: ReviewVerdictRecord, labelOf?: (id: string) => string) {
  render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <PreviousAttempt verdict={verdict} labelOf={labelOf} />
    </NextIntlClientProvider>,
  );
}

describe('PreviousAttempt', () => {
  it('says nothing was left only when neither a comment nor a ruling carries words', () => {
    show({ ...BASE, decisions: [{ itemId: 'p1', approved: false, comment: '  ' }] });
    expect(screen.getByText('No comment was left.')).toBeTruthy();
  });

  it('shows the comment on the whole when there is one', () => {
    show({ ...BASE, comment: 'Se på perfektum.' });
    expect(screen.getByText('Se på perfektum.')).toBeTruthy();
    expect(screen.queryByText('No comment was left.')).toBeNull();
  });

  it('shows each prompt ruling under its name when the template has no overall comment', () => {
    show(
      {
        ...BASE,
        decisions: [
          { itemId: 'p1', approved: false, comment: 'Uttalen er ikke tydelig.' },
          { itemId: 'p2', approved: true, comment: 'Bra lesing.' },
        ],
      },
      (id) => (id === 'p1' ? 'Presentasjon' : 'Intervjuet'),
    );
    expect(screen.getByText('Presentasjon')).toBeTruthy();
    expect(screen.getByText('Uttalen er ikke tydelig.')).toBeTruthy();
    expect(screen.getByText('Intervjuet')).toBeTruthy();
    expect(screen.getByText('Bra lesing.')).toBeTruthy();
    expect(screen.queryByText('No comment was left.')).toBeNull();
  });
});

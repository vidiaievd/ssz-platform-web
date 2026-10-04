import { fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import type { RecipeIssue } from '../types';

import { RecipeDot } from './recipe-dot';

const AUDIO: RecipeIssue = {
  code: 'RECIPE_BELOW_MIN',
  level: 'warning',
  ruleIndex: 1,
  rule: { axis: 'input', values: ['audio', 'video'], min: 1 },
  count: 0,
  min: 1,
  total: 6,
};

const PICKED: RecipeIssue = {
  code: 'RECIPE_ABOVE_SHARE',
  level: 'warning',
  ruleIndex: 2,
  rule: { axis: 'modality', values: ['recognition'], maxShare: 0.6 },
  count: 4,
  maxShare: 0.6,
  total: 6,
};

function renderDot(issues: RecipeIssue[], onRowClick = vi.fn()) {
  render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <div onClick={onRowClick}>
        <RecipeDot issues={issues} />
      </div>
    </NextIntlClientProvider>,
  );
  return onRowClick;
}

describe('RecipeDot', () => {
  it('draws nothing for a lesson that meets the recipe', () => {
    renderDot([]);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('says what is missing and what would close it, on demand', () => {
    renderDot([AUDIO, PICKED]);

    fireEvent.click(screen.getByRole('button', { name: '2 recipe rules not met' }));

    expect(
      screen.getByText('0 of the 1 needed: at least 1 item — Material: Recording or Video'),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        // Dictation is live since plan 68: named first, without «(soon)».
        /Closes it: Dictation and .*\(soon\) — or turn on a recording in an exercise\./,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText('4 of 6 items: at most 60% of items — Known by: Picked out'),
    ).toBeInTheDocument();
  });

  // The row underneath selects the module on click; reading the hint must not.
  it('does not select the lesson it sits on', () => {
    const onRowClick = renderDot([AUDIO]);

    fireEvent.click(screen.getByRole('button', { name: '1 recipe rule not met' }));

    expect(onRowClick).not.toHaveBeenCalled();
  });
});

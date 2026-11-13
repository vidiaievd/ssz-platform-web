// @vitest-environment jsdom

import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it } from 'vitest';

import messages from '../../../../../messages/en/Pronunciation.json';
import { MelodyChart } from './melody-chart';

const show = (melody: Parameters<typeof MelodyChart>[0]['melody']) =>
  render(
    <NextIntlClientProvider locale="en" messages={{ Pronunciation: messages }}>
      <MelodyChart melody={melody} />
    </NextIntlClientProvider>,
  );

describe('MelodyChart', () => {
  it('draws one line each and breaks the line where the voice breaks', () => {
    const { container } = show({ stepMs: 10, learner: [1, 2, null, 3, 4], reference: [2, 3, 4] });
    // learner: two runs; reference: one.
    expect(container.querySelectorAll('path')).toHaveLength(3);
    expect(container.querySelectorAll('path[stroke-dasharray]')).toHaveLength(1);
    expect(screen.getByRole('img').getAttribute('aria-label')).toContain('dashed');
  });

  it('says so when there is nothing to draw', () => {
    show({ stepMs: 10, learner: [null, null], reference: [1, null] });
    expect(screen.getByText('No melody could be drawn.')).toBeTruthy();
  });
});

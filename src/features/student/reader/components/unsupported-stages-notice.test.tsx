import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import { UnsupportedStagesNotice } from './unsupported-stages-notice';

function renderNotice(count: number) {
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <UnsupportedStagesNotice count={count} />
    </NextIntlClientProvider>,
  );
}

describe('UnsupportedStagesNotice', () => {
  it('renders nothing when every stage was drawn', () => {
    const { container } = renderNotice(0);

    expect(container).toBeEmptyDOMElement();
  });

  it('names how many questions are missing from the lesson', () => {
    renderNotice(1);

    expect(screen.getByRole('status')).toHaveTextContent("One question isn't shown here");
  });

  it('counts more than one', () => {
    renderNotice(3);

    expect(screen.getByRole('status')).toHaveTextContent("3 questions aren't shown here");
  });
});

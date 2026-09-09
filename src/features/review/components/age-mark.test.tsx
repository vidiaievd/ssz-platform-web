import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';

import { AgeMark } from './age-mark';
import { AgeSpread } from './age-spread';

function renderWithIntl(ui: React.ReactNode) {
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      {ui}
    </NextIntlClientProvider>,
  );
}

describe('AgeMark', () => {
  it('says the age in words, so colour is never the only signal', () => {
    renderWithIntl(<AgeMark hours={3} slaHours={24} />);
    expect(screen.getByText('3 hours')).toBeInTheDocument();
  });

  it('counts a wait over a day in days', () => {
    renderWithIntl(<AgeMark hours={98} slaHours={24} />);
    expect(screen.getByText(/4 days/)).toBeInTheDocument();
  });

  it('names how far past the promise a late submission is', () => {
    renderWithIntl(<AgeMark hours={30} slaHours={24} />);
    expect(screen.getByText('1 day', { exact: false })).toHaveTextContent('1 day · 6 hours past');
  });

  it('says nothing about lateness at exactly the promise', () => {
    renderWithIntl(<AgeMark hours={24} slaHours={24} />);
    expect(screen.getByText('1 day')).toBeInTheDocument();
    expect(screen.queryByText(/past/)).not.toBeInTheDocument();
  });
});

describe('AgeSpread', () => {
  it('draws one bar per submission', () => {
    const { container } = renderWithIntl(<AgeSpread hours={[2, 40, 9]} slaHours={24} />);
    expect(container.querySelectorAll('span[style*="background"]')).toHaveLength(3);
  });

  it('names the size of the queue and its oldest member', () => {
    renderWithIntl(<AgeSpread hours={[2, 40, 9]} slaHours={24} />);
    expect(screen.getByRole('img')).toHaveAccessibleName('3 submissions, oldest 1 day');
  });

  it('renders nothing at all for an empty queue', () => {
    const { container } = renderWithIntl(<AgeSpread hours={[]} slaHours={24} />);
    expect(container).toBeEmptyDOMElement();
  });
});

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import type { MultipleChoiceContent } from '@/lib/shared-kernel/multiple-choice';
import { content, option, question, settings } from '@/lib/shared-kernel/multiple-choice/fixtures.test-support';

import { MultipleChoicePreview } from './multiple-choice-preview';

function renderPreview(exercise: MultipleChoiceContent = content()) {
  render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <MultipleChoicePreview exercise={exercise} />
    </NextIntlClientProvider>,
  );
  return userEvent.setup();
}

/** The runner's own option buttons, ignoring the panel's controls. */
function optionButton(text: string) {
  return screen.getByRole('button', { name: new RegExp(text) });
}

describe('MultipleChoicePreview', () => {
  it('says there is nothing to answer while no question is finished', () => {
    renderPreview(content({ questions: [question({ stem: '' })] }));

    expect(screen.getByText(/Nothing to answer yet/)).toBeInTheDocument();
  });

  it('judges a pick with the author own key', async () => {
    const user = renderPreview(content({ settings: settings({ shuffle: false }) }));

    await user.click(optionButton('var'));
    await user.click(screen.getByRole('button', { name: 'Check' }));

    expect(screen.getByText('Correct.')).toBeInTheDocument();
    expect(screen.getByText(/Indirekte tale i fortid/)).toBeInTheDocument();
  });

  it('withholds the key while a retry is still available', async () => {
    const user = renderPreview(content({ settings: settings({ shuffle: false, retry: 'one' }) }));

    await user.click(optionButton('er'));
    await user.click(screen.getByRole('button', { name: 'Check' }));

    // The rebuttal of the option that was picked, and nothing about the right answer: this
    // is what a student sees, so the panel must not show the author more.
    expect(screen.getByText(/Etter «sa» flyttes presens/)).toBeInTheDocument();
    expect(screen.queryByText(/Indirekte tale i fortid/)).toBeNull();
    expect(screen.getByRole('button', { name: /Try again/ })).toBeInTheDocument();
  });

  it('closes the question on the first miss when there is one attempt', async () => {
    const user = renderPreview(content({ settings: settings({ shuffle: false, retry: 'none' }) }));

    await user.click(optionButton('er'));
    await user.click(screen.getByRole('button', { name: 'Check' }));

    expect(screen.queryByRole('button', { name: /Try again/ })).toBeNull();
    expect(screen.getByText(/Indirekte tale i fortid/)).toBeInTheDocument();
  });

  it('judges on the tap when the author asked for an instant check', async () => {
    const user = renderPreview(content({ settings: settings({ shuffle: false, instant: true }) }));

    await user.click(optionButton('var'));

    expect(screen.queryByRole('button', { name: 'Check' })).toBeNull();
    expect(screen.getByText('Correct.')).toBeInTheDocument();
  });

  it('drops an empty option and renumbers the letters', () => {
    renderPreview(
      content({
        settings: settings({ shuffle: false }),
        questions: [
          question({
            options: [
              option({ id: 'a', text: '' }),
              option({ id: 'b', text: 'var', correct: true }),
              option({ id: 'c', text: 'har vært' }),
            ],
          }),
        ],
      }),
    );

    expect(optionButton('var')).toHaveTextContent('A');
    expect(optionButton('har vært')).toHaveTextContent('B');
  });

  it('restarts the attempt when the set changes under it', async () => {
    const user = renderPreview(content({ settings: settings({ shuffle: false }) }));

    await user.click(optionButton('var'));
    await user.click(screen.getByRole('button', { name: 'Check' }));
    expect(screen.getByText('Correct.')).toBeInTheDocument();

    render(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <MultipleChoicePreview
          exercise={content({ settings: settings({ shuffle: false, retry: 'none' }) })}
        />
      </NextIntlClientProvider>,
    );

    expect(screen.getAllByRole('button', { name: 'Check' })).not.toHaveLength(0);
  });

  it('offers a re-deal only while the options are shuffled', () => {
    const { unmount } = render(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <MultipleChoicePreview exercise={content({ settings: settings({ shuffle: false }) })} />
      </NextIntlClientProvider>,
    );
    expect(screen.queryByRole('button', { name: /Deal again/ })).toBeNull();
    unmount();

    renderPreview(content({ settings: settings({ shuffle: true }) }));
    expect(screen.getByRole('button', { name: /Deal again/ })).toBeInTheDocument();
  });
});

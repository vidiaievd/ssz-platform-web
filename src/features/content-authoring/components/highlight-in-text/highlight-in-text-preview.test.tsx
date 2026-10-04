import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it } from 'vitest';

import { MarkableText } from '@/features/student/exercises/runner/markable-text';
import { enMessages } from '@/lib/i18n/messages';
import { emptyContent, tokenize } from '@/lib/shared-kernel/highlight-in-text';
import {
  exercise,
  question,
  SAMPLE_TEXT,
  spanAt,
} from '@/lib/shared-kernel/highlight-in-text/fixtures.test-support';

import { HighlightInTextPreview } from './highlight-in-text-preview';

function draw(content = exercise()) {
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <HighlightInTextPreview exercise={content} />
    </NextIntlClientProvider>,
  );
}

const passage = () =>
  screen.getByRole('group', { name: 'Marker alle verbene som står i preteritum.' });

describe('HighlightInTextPreview', () => {
  it('hands the student the projection: ready questions only, nothing marked', () => {
    const { container } = draw(
      exercise({ questions: [...exercise().questions, question('q3', { prompt: '' })] }),
    );
    expect(screen.getByText('Question 1 of 2, 0 done')).toBeInTheDocument();
    expect(container.querySelectorAll('[data-m]')).toHaveLength(0);
  });

  it('judges a check with the kernel — a real verdict, nothing recorded', async () => {
    draw();
    await userEvent.click(within(passage()).getByRole('button', { name: 'reiste' }));
    await userEvent.click(within(passage()).getAllByRole('button', { name: 'Bodø' })[0]!);
    await userEvent.click(screen.getByRole('button', { name: 'Check (2)' }));
    expect(screen.getByText('1 of 8 right · 1 too many')).toBeInTheDocument();
    expect(screen.getByText('q1 fp')).toBeInTheDocument();
  });

  it('switches between the phone and the desktop layout (Q4-A)', async () => {
    const { container } = draw();
    expect(container.querySelector('[data-layout="phone"]')).not.toBeNull();
    await userEvent.click(screen.getByRole('radio', { name: 'Web' }));
    expect(container.querySelector('[data-layout="desktop"]')).not.toBeNull();
    // The desktop eyebrow carries the exercise title.
    expect(screen.getByText('Preteritum i en feriefortelling')).toBeInTheDocument();
  });

  it('draws everything and accepts nothing in Static', async () => {
    draw();
    await userEvent.click(screen.getByRole('radio', { name: 'Static' }));
    expect(within(passage()).queryAllByRole('button')).toHaveLength(0);
  });

  it('restarts the attempt', async () => {
    draw();
    await userEvent.click(within(passage()).getByRole('button', { name: 'reiste' }));
    await userEvent.click(screen.getByRole('button', { name: 'Check (1)' }));
    await userEvent.click(screen.getByRole('button', { name: 'Restart the attempt' }));
    expect(screen.getByRole('button', { name: 'Check' })).toBeDisabled();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('shows the empty state for a draft with nothing ready', () => {
    draw(emptyContent());
    expect(screen.getByText('Nothing to mark yet')).toBeInTheDocument();
  });

  /** AC-X10 — the preview, the builder canvas and the runner are one renderer. */
  it('draws the passage through MarkableText, token for token', () => {
    draw(exercise({ questions: [question('q1', { spans: [spanAt(SAMPLE_TEXT, 'reiste')] })] }));
    const inPreview = screen.getByRole('group', { name: 'Prompt q1' });
    const bare = render(<MarkableText text={SAMPLE_TEXT} live unit="word" />);
    const markup = (el: Element) =>
      [...el.querySelectorAll('[data-i]')].map((t) => t.outerHTML).join('');
    expect(markup(inPreview)).toBe(markup(bare.container));
    expect(inPreview.querySelectorAll('[data-i]')).toHaveLength(tokenize(SAMPLE_TEXT).length);
  });
});

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { NextIntlClientProvider } from 'next-intl';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import { emptyContent, type HighlightInTextContent } from '@/lib/shared-kernel/highlight-in-text';
import { exercise, SAMPLE_TEXT } from '@/lib/shared-kernel/highlight-in-text/fixtures.test-support';

import { StepText } from './step-text';

/** The step over a document it owns, as the builder holds it; every change is recorded. */
function Harness({
  initial,
  spy,
}: {
  initial: HighlightInTextContent;
  spy: (ex: HighlightInTextContent) => void;
}) {
  const [ex, setEx] = useState(initial);
  return (
    <StepText
      exercise={ex}
      onChange={(next) => {
        spy(next);
        setEx(next);
      }}
    />
  );
}

function draw(initial: HighlightInTextContent) {
  const spy = vi.fn();
  const view = render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <Harness initial={initial} spy={spy} />
    </NextIntlClientProvider>,
  );
  return { ...view, spy, last: () => spy.mock.calls.at(-1)?.[0] as HighlightInTextContent };
}

const passage = () => screen.getByRole('textbox', { name: 'The passage' });
/** The sentence with «tok» and «gikk» in it — both are keyed in q1. */
const SENTENCE = 'Vi tok toget til Bodø, og der gikk vi om bord i hurtigbåten. ';

describe('StepText', () => {
  it('edits the title and the instruction straight into the document', async () => {
    const { last } = draw(emptyContent());
    await userEvent.type(screen.getByLabelText(/Exercise title/), 'Ferie');
    expect(last().title).toBe('Ferie');
    await userEvent.type(screen.getByLabelText('Instruction above the text'), 'Les.');
    expect(last().instruction).toBe('Les.');
  });

  it('keeps the passage a draft until the edit is applied, and says nothing can break without marks', async () => {
    const { spy, last } = draw(emptyContent());
    await userEvent.type(passage(), 'Jeg reiste hjem.');
    expect(spy).not.toHaveBeenCalled();
    expect(screen.getByText('Nothing is marked yet, so nothing can break.')).toBeInTheDocument();
    expect(screen.getByText(/3 words · blank line starts a paragraph/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Apply the edit' }));
    expect(last().text).toBe('Jeg reiste hjem.');
    expect(screen.queryByRole('button', { name: 'Apply the edit' })).toBeNull();
  });

  it('«See what moves» reports what applying will orphan, and saves nothing (AC-R5)', async () => {
    const { spy, last } = draw(exercise());
    await userEvent.clear(passage());
    await userEvent.click(passage());
    await userEvent.paste(SAMPLE_TEXT.replace(SENTENCE, ''));
    expect(screen.getByText(/14 marks are already placed in this text\./)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'See what moves' }));
    expect(spy).not.toHaveBeenCalled();
    expect(screen.getByRole('status')).toHaveTextContent(
      '2 marks will lose their place and wait for you in step 2.',
    );

    await userEvent.click(screen.getByRole('button', { name: 'Apply the edit' }));
    expect(
      last()
        .orphans.map((o) => o.surface)
        .sort(),
    ).toEqual(['gikk', 'tok']);
  });

  it('says every mark is kept when an edit touches none of them (AC-R1)', async () => {
    draw(exercise());
    await userEvent.type(passage(), ' Slutt.');
    await userEvent.click(screen.getByRole('button', { name: 'See what moves' }));
    expect(screen.getByRole('status')).toHaveTextContent('Every mark finds its words again.');
  });

  it('draws the saved passage as the student will read it, through the one renderer', () => {
    const { container } = draw(exercise());
    const reads = screen.getByRole('group', { name: 'How it reads' });
    expect(reads).toHaveAttribute('data-markable-text');
    expect(container.querySelectorAll('[data-markable-text] p')).toHaveLength(2);
    expect(screen.getByText('2 questions over this text')).toBeInTheDocument();
    // Read-only: nothing in it is a button.
    expect(reads.querySelector('[role="button"]')).toBeNull();
  });

  it('has no axe violations, blank and with a pending edit (AC-X6)', async () => {
    const blank = draw(emptyContent());
    expect(
      (await axe.run(blank.container, { rules: { 'color-contrast': { enabled: false } } }))
        .violations,
    ).toEqual([]);
    blank.unmount();

    const full = draw(exercise());
    await userEvent.type(passage(), ' Slutt.');
    expect(
      (await axe.run(full.container, { rules: { 'color-contrast': { enabled: false } } }))
        .violations,
    ).toEqual([]);
  });
});

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { describe, expect, it, vi } from 'vitest';

import { emptyContent } from '@/lib/shared-kernel/information-transfer';

import type { InformationTransferDocument } from './edits';
import { StepSource } from './step-source';
import { blankDocument, documentOf, Harness, PAGE_RULES, sampleDocument } from './test-support';

vi.mock('@/features/media', () => ({
  useMediaAsset: () => ({ data: undefined }),
  uploadAsset: vi.fn(),
}));

function renderStep(initial: InformationTransferDocument) {
  const changes: InformationTransferDocument[] = [];
  const view = render(
    <Harness initial={initial} step={StepSource} onChange={(next) => changes.push(next)} />,
  );
  return { user: userEvent.setup(), changes, last: () => changes[changes.length - 1]!, ...view };
}

describe('StepSource — the source (INF-B1, B2)', () => {
  it('shows a blank text exercise its blocker where it is fixed, with the pack placeholders', () => {
    renderStep(blankDocument());
    expect(screen.getByLabelText(/^Title/)).toHaveAttribute(
      'placeholder',
      'Fyll ut skjemaet: kurs på biblioteket',
    );
    expect(screen.getByLabelText(/^Text/)).toBeInvalid();
    expect(screen.getByText('Without a source there is nothing to transfer.')).toBeInTheDocument();
    expect(screen.getByText('0 words')).toBeInTheDocument();
    // The warnings of the first card: no title, no instruction.
    expect(screen.getByText(/has no title/)).toBeInTheDocument();
    expect(screen.getByText(/No instruction/)).toBeInTheDocument();
  });

  it('writes the title, the instruction, the heading and the text into the document', async () => {
    const { user, last } = renderStep(blankDocument());
    await user.type(screen.getByLabelText(/^Title/), 'Skjema');
    expect(last().title).toBe('Skjema');
    await user.type(screen.getByLabelText(/^Instruction to the student/), 'Fyll ut.');
    expect(last().instruction).toBe('Fyll ut.');
    await user.type(screen.getByLabelText(/^Heading over the source/), 'Kurs');
    expect(last().passageTitle).toBe('Kurs');
    await user.type(screen.getByLabelText(/^Text/), 'Rom 204 koster 450 kr');
    expect(last().passage).toBe('Rom 204 koster 450 kr');
    expect(screen.queryByText('Without a source there is nothing to transfer.')).toBeNull();
    expect(screen.getByText('5 words')).toBeInTheDocument();
  });

  it('one switch moves the source: a recording brings the audio cards and the transcript note', async () => {
    const { user, last } = renderStep(sampleDocument('text'));
    expect(screen.queryByText('Transcript')).toBeNull();
    await user.click(screen.getByRole('radio', { name: 'A recording' }));
    expect(last().sourceKind).toBe('audio');
    expect(last().audio.enabled).toBe(true);
    expect(screen.getByText('The transcript is not optional here.')).toBeInTheDocument();
    // The text stays in the document: the author trying both ways loses nothing.
    expect(last().passage).toContain('NORSKKURS');
    await user.click(screen.getByRole('radio', { name: 'A text' }));
    expect(last().sourceKind).toBe('text');
    expect(screen.getByLabelText(/^Text/)).toBeInTheDocument();
  });

  it('warns on a recording without a transcript', async () => {
    const { user } = renderStep(documentOf({ ...emptyContent('nb'), sourceKind: 'text' }));
    await user.click(screen.getByRole('radio', { name: 'A recording' }));
    expect(
      screen.getByText('The transcript is not optional here.').closest('[data-tone]'),
    ).toHaveAttribute('data-tone', 'warn');
  });

  it('sets the focus axis', async () => {
    const { user, last } = renderStep(blankDocument());
    await user.click(screen.getByRole('radio', { name: 'Vocabulary' }));
    expect(last().focus).toBe('vocabulary');
  });

  it('names the pack of the course and offers no Norwegian to a course without one', () => {
    const { unmount } = renderStep(blankDocument());
    expect(screen.getByRole('combobox', { name: 'Language pack' })).toHaveTextContent(
      'Norsk (bokmål)',
    );
    unmount();

    renderStep(documentOf(emptyContent('sv')));
    expect(screen.getByRole('combobox', { name: 'Language pack' })).toBeDisabled();
    expect(screen.getByText('No pack for this language')).toBeInTheDocument();
    expect(screen.getByText(/No language pack for «sv»/)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Title/)).toHaveAttribute('placeholder', '');
  });

  it('has no accessibility violations', async () => {
    const { container } = renderStep(sampleDocument('text'));
    expect((await axe.run(container, PAGE_RULES)).violations).toEqual([]);
  });
});

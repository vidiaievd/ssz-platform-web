import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { describe, expect, it } from 'vitest';

import { newPrompt } from '@/lib/shared-kernel/read-aloud';

import type { ReadAloudDocument } from './edits';
import { StepListen } from './step-listen';
import { blankDocument, documentOf, Harness, PAGE_RULES, sampleReadAloud } from './test-support';
import { emptyContent } from '@/lib/shared-kernel/read-aloud';

function renderStep(initial: ReadAloudDocument, onChange?: (next: ReadAloudDocument) => void) {
  const view = render(<Harness initial={initial} step={StepListen} onChange={onChange} />);
  return { user: userEvent.setup(), ...view };
}

/** One prompt with a passage and nothing marked. */
function withPassage(text: string): ReadAloudDocument {
  const base = emptyContent('nb');
  return documentOf({ ...base, prompts: [{ ...newPrompt('read'), id: 'p1', text }] });
}

describe('StepListen — the passage (RA-B5)', () => {
  it('draws every word as a button and presses the marked ones', () => {
    renderStep(sampleReadAloud());
    const first = screen.getByRole('region', { name: 'Avsnitt 1' });
    expect(within(first).getByRole('button', { name: 'søkte' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(within(first).getByRole('button', { name: 'Kjetil' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(within(first).getByRole('button', { name: 'jobben' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('marks a word on a tap and lists it with an empty note, unmarks it on a second tap', async () => {
    const { user } = renderStep(withPassage('Jeg søkte på jobben.'));
    await user.click(screen.getByRole('button', { name: 'søkte' }));
    expect(screen.getByLabelText('What to listen for in «søkte»')).toHaveValue('');
    await user.click(screen.getByRole('button', { name: 'søkte' }));
    expect(screen.queryByLabelText('What to listen for in «søkte»')).not.toBeInTheDocument();
  });

  it('treats the same word with a capital letter as one word', async () => {
    const { user } = renderStep(withPassage('Kjetil sa at Kjetil kom.'));
    const [first] = screen.getAllByRole('button', { name: 'Kjetil' });
    await user.click(first!);
    for (const button of screen.getAllByRole('button', { name: 'Kjetil' })) {
      expect(button).toHaveAttribute('aria-pressed', 'true');
    }
    expect(screen.getAllByLabelText(/What to listen for/)).toHaveLength(1);
  });

  it('keeps the punctuation out of the word and in the text', () => {
    renderStep(withPassage('Hei, du!'));
    expect(screen.getByRole('button', { name: 'Hei' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Hei,' })).not.toBeInTheDocument();
  });

  it('takes a note for a focus word and lets the author remove the word (RA-B5)', async () => {
    const { user } = renderStep(sampleReadAloud());
    const field = screen.getByLabelText('What to listen for in «søkte»');
    await user.type(field, ' ny');
    expect(field).toHaveValue('kj-lyd etter s: ikke «sj». ny');
    await user.click(screen.getByRole('button', { name: 'Remove focus word «søkte»' }));
    expect(screen.queryByLabelText('What to listen for in «søkte»')).not.toBeInTheDocument();
  });

  it('offers no passage to mark outside read mode', () => {
    const base = sampleReadAloud();
    renderStep({ ...base, mode: 'monologue' });
    expect(screen.queryByText('Mark the words you are grading')).not.toBeInTheDocument();
  });
});

describe('StepListen — the note (RA-B6)', () => {
  it('requires it, marks the card and says why a prompt cannot be assigned without it', () => {
    renderStep(blankDocument());
    expect(screen.getByRole('region', { name: 'Prompt 1' })).toHaveAttribute('data-bad', 'true');
    expect(screen.getByRole('alert')).toHaveTextContent(/cannot be graded consistently/);
    expect(screen.getByLabelText(/Listening note/)).toBeInvalid();
  });

  it('clears the error once the note is written', async () => {
    const { user } = renderStep(blankDocument());
    await user.type(screen.getByLabelText(/Listening note/), 'Lytt etter kj.');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Prompt 1' })).not.toHaveAttribute('data-bad');
  });

  it('asks for a note on every prompt, not one for the exercise', () => {
    renderStep(sampleReadAloud());
    expect(screen.getAllByLabelText(/Listening note/)).toHaveLength(2);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('StepListen — a11y', () => {
  it('has no axe violations', async () => {
    const { container } = renderStep(sampleReadAloud());
    expect((await axe.run(container, PAGE_RULES)).violations).toEqual([]);
  });
});

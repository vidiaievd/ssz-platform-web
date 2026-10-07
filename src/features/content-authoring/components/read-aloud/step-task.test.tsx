import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { describe, expect, it, vi } from 'vitest';

import { RA_MAX_PROMPTS } from '@/lib/shared-kernel/read-aloud';

import type { ReadAloudDocument } from './edits';
import { addPrompt } from './edits';
import { blankDocument, documentOf, Harness, PAGE_RULES, sampleReadAloud } from './test-support';

vi.mock('@/features/media', () => ({
  ACCEPTED_IMAGE_TYPES: ['image/png'],
  MAX_FILE_SIZE_BYTES: 5_000_000,
  uploadAsset: vi.fn(),
  useMediaAsset: () => ({ data: undefined, isLoading: false }),
}));

const { StepTask } = await import('./step-task');

function renderStep(initial: ReadAloudDocument, onChange?: (next: ReadAloudDocument) => void) {
  const view = render(<Harness initial={initial} step={StepTask} onChange={onChange} />);
  return { user: userEvent.setup(), ...view };
}

const mode = (name: RegExp) => screen.getByRole('button', { name });

describe('StepTask — mode (RA-B2)', () => {
  it('draws the three modes with their retrieval and presses the current one', () => {
    renderStep(blankDocument());
    expect(mode(/Read aloud/)).toHaveAttribute('aria-pressed', 'true');
    expect(mode(/Monologue from support/)).toHaveAttribute('aria-pressed', 'false');
    expect(mode(/A turn in a dialogue/)).toHaveAttribute('aria-pressed', 'false');
    expect(within(mode(/Read aloud/)).getByText('retrieval: recall')).toBeInTheDocument();
    expect(within(mode(/Monologue/)).getByText('retrieval: production')).toBeInTheDocument();
  });

  it('says what the mode is worth as evidence, and changes the line with the mode (RA-B2)', async () => {
    const { user } = renderStep(blankDocument());
    expect(screen.getByText(/success ceiling medium, failure floor low/)).toBeInTheDocument();
    await user.click(mode(/Monologue/));
    expect(screen.getByText(/success ceiling high, failure floor medium/)).toBeInTheDocument();
  });

  it('keeps the passage when the mode is switched away and back, and resets the lengths', async () => {
    const seen: ReadAloudDocument[] = [];
    const { user } = renderStep(sampleReadAloud(), (next) => seen.push(next));
    await user.click(mode(/Monologue/));
    expect(screen.queryByLabelText('Text to read aloud')).not.toBeInTheDocument();
    expect(seen.at(-1)?.prompts[0]).toMatchObject({
      minSeconds: 40,
      maxSeconds: 120,
      prepSeconds: 45,
    });
    await user.click(mode(/Read aloud/));
    const passage = screen.getAllByLabelText(/Text to read aloud/)[0] as HTMLTextAreaElement;
    expect(passage.value).toContain('Jeg søkte på jobben');
  });
});

describe('StepTask — a prompt (RA-B3)', () => {
  it('measures the passage in words and time aloud', () => {
    renderStep(sampleReadAloud());
    expect(screen.getByText(/23 words · about 0:13 aloud/)).toBeInTheDocument();
  });

  it('says there is nothing to read, and marks the card, when the passage is empty', () => {
    renderStep(blankDocument());
    expect(screen.getByText('Without a text there is nothing to read.')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Prompt 1' })).toHaveAttribute('data-bad', 'true');
  });

  it('clears the mark once the passage is typed', async () => {
    const { user } = renderStep(blankDocument());
    await user.type(screen.getByLabelText(/Text to read aloud/), 'Hei på deg');
    expect(screen.getByRole('region', { name: 'Prompt 1' })).not.toHaveAttribute('data-bad');
    expect(screen.getByText(/3 words/)).toBeInTheDocument();
  });

  it('shows the situation and the line to answer in dialogue mode, the latter required', async () => {
    const { user } = renderStep(blankDocument());
    await user.click(mode(/A turn in a dialogue/));
    expect(screen.getByLabelText('Situation')).toBeInTheDocument();
    expect(screen.getByText(/Without the partner's line/)).toBeInTheDocument();
    await user.type(screen.getByLabelText(/The line the student answers/), 'Hva feiler det deg?');
    expect(screen.queryByText(/Without the partner's line/)).not.toBeInTheDocument();
  });

  it('builds a plan in monologue mode and toggles a point between must and optional', async () => {
    const { user } = renderStep(blankDocument());
    await user.click(mode(/Monologue/));
    await user.click(screen.getByRole('button', { name: 'Add point' }));
    await user.type(screen.getByLabelText('Plan point 1'), 'Hvem er på bildet?');
    const chip = screen.getByRole('button', { name: 'must be covered' });
    expect(chip).toHaveAttribute('aria-pressed', 'true');
    await user.click(chip);
    expect(screen.getByRole('button', { name: 'optional' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    await user.click(screen.getByRole('button', { name: 'Remove plan point 1' }));
    expect(screen.queryByLabelText('Plan point 1')).not.toBeInTheDocument();
  });
});

describe('StepTask — prompts (RA-B10)', () => {
  it('counts the recordings and keeps the last prompt', async () => {
    const { user } = renderStep(blankDocument());
    expect(screen.getByText('1 recording')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Delete prompt/ })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Add prompt' }));
    expect(screen.getByText('2 recordings')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Delete prompt/ })[0]).toBeEnabled();
  });

  it('refuses a seventh prompt', () => {
    let doc = blankDocument();
    while (doc.prompts.length < RA_MAX_PROMPTS) doc = addPrompt(doc);
    renderStep(doc);
    expect(screen.getByRole('button', { name: 'Add prompt' })).toBeDisabled();
  });

  it('labels a prompt by what the author wrote, otherwise by its place', () => {
    renderStep(sampleReadAloud());
    expect(screen.getByRole('region', { name: 'Avsnitt 1' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Avsnitt 2' })).toBeInTheDocument();
  });
});

describe('StepTask — the audio layer (RA-B4)', () => {
  it('says what a clip is for in this mode while the layer is off', async () => {
    const { user } = renderStep(blankDocument());
    expect(screen.getByText(/A model reading gives the student the target/)).toBeInTheDocument();
    await user.click(mode(/Monologue/));
    expect(screen.getByText(/A monologue rarely needs a clip/)).toBeInTheDocument();
    await user.click(mode(/A turn in a dialogue/));
    expect(screen.getByText(/Attach the partner line as audio/)).toBeInTheDocument();
  });

  it('mounts the shared cards when switched on', async () => {
    const { user } = renderStep(documentOf());
    await user.click(screen.getByRole('switch'));
    expect(screen.getByText('The clip')).toBeInTheDocument();
    expect(screen.getByText('How they may listen')).toBeInTheDocument();
    expect(screen.queryByText(/A model reading gives the student/)).not.toBeInTheDocument();
  });
});

describe('StepTask — a11y', () => {
  it('has no axe violations in any mode', async () => {
    const { container, user } = renderStep(sampleReadAloud());
    expect((await axe.run(container, PAGE_RULES)).violations).toEqual([]);
    await user.click(mode(/Monologue/));
    expect((await axe.run(container, PAGE_RULES)).violations).toEqual([]);
    await user.click(mode(/A turn in a dialogue/));
    expect((await axe.run(container, PAGE_RULES)).violations).toEqual([]);
  });
});

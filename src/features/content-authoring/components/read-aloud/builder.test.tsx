import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { describe, expect, it, vi } from 'vitest';

import { issues, stepState } from '@/lib/shared-kernel/read-aloud';

import type { ReadAloudDocument } from './edits';
import { blankDocument, Intl, PAGE_RULES, sampleReadAloud } from './test-support';

vi.mock('@/features/media', () => ({
  ACCEPTED_IMAGE_TYPES: ['image/png'],
  MAX_FILE_SIZE_BYTES: 5_000_000,
  uploadAsset: vi.fn(),
  useMediaAsset: () => ({ data: undefined, isLoading: false }),
}));

const { ReadAloudBuilder } = await import('./builder');

function renderBuilder(
  initial: ReadAloudDocument,
  onDocumentChange?: (d: ReadAloudDocument) => void,
) {
  const view = render(
    <Intl>
      <ReadAloudBuilder initialExercise={initial} onDocumentChange={onDocumentChange} />
    </Intl>,
  );
  return { user: userEvent.setup(), ...view };
}

const tab = (name: string) => screen.getByRole('tab', { name: new RegExp(`^\\d?\\s*${name}`) });

describe('ReadAloudBuilder — the rail (RA-B1)', () => {
  it('names the five steps with their subtitles', () => {
    renderBuilder(blankDocument());
    for (const [label, sub] of [
      ['Task', 'mode and material'],
      ['Listen for', "the grader's brief"],
      ['Rubric', 'how it is scored'],
      ['Recording', 'takes and limits'],
      ['Flow', 'review and queue'],
    ] as const) {
      expect(within(tab(label)).getByText(sub)).toBeInTheDocument();
    }
  });

  it('shows the blockers of a blank draft on the rail from the first mount', () => {
    const blank = blankDocument();
    renderBuilder(blank);
    const ctx = { audio: false };
    // The passage and the note — one blocker each; the default rubric is complete.
    expect(stepState(blank, 1, ctx).errs).toBe(1);
    expect(within(tab('Task')).getByText('1 problem')).toBeInTheDocument();
    expect(within(tab('Listen for')).getByText('1 problem')).toBeInTheDocument();
    expect(within(tab('Rubric')).queryByText(/problem/)).not.toBeInTheDocument();
  });

  it('lets a dot follow the document: writing the passage lifts the step-1 blocker', async () => {
    const { user } = renderBuilder(blankDocument());
    await user.type(screen.getByLabelText(/Text to read aloud/), 'Hei på deg');
    expect(within(tab('Task')).queryByText(/problem/)).not.toBeInTheDocument();
    expect(within(tab('Listen for')).getByText('1 problem')).toBeInTheDocument();
  });

  it('opens on the task and moves on with the step navigation', async () => {
    const { user } = renderBuilder(sampleReadAloud());
    expect(tab('Task')).toHaveAttribute('aria-selected', 'true');
    await user.click(screen.getByRole('button', { name: /Next: Listen for/ }));
    expect(tab('Listen for')).toHaveAttribute('aria-selected', 'true');
    await user.click(screen.getByRole('button', { name: /Next: Rubric/ }));
    expect(tab('Rubric')).toHaveAttribute('aria-selected', 'true');
    await user.click(screen.getByRole('button', { name: /Back/ }));
    expect(tab('Listen for')).toHaveAttribute('aria-selected', 'true');
  });

  it('takes the layer into the count: listening on with nothing to play blocks step 1', async () => {
    const { user } = renderBuilder(sampleReadAloud());
    expect(within(tab('Task')).queryByText(/problem/)).not.toBeInTheDocument();
    await user.click(screen.getByRole('switch'));
    expect(within(tab('Task')).getByText('1 problem')).toBeInTheDocument();
  });
});

describe('ReadAloudBuilder — one document', () => {
  it('reports every edit of every step as the same document', async () => {
    const seen: ReadAloudDocument[] = [];
    const { user } = renderBuilder(sampleReadAloud(), (d) => seen.push(d));
    await user.type(screen.getByLabelText(/^Title/), '!');
    await user.click(screen.getByRole('tab', { name: /Rubric/ }));
    await user.click(
      within(screen.getByRole('region', { name: 'Flyt' })).getByRole('radio', { name: '×2' }),
    );
    const last = seen.at(-1)!;
    expect(last.title).toBe('Les høyt — jobbsøknad!');
    expect(last.rubric.find((c) => c.id === 'flow')?.weight).toBe(2);
    expect(last.updatedAt).toBe('2026-10-07T10:00:00.000Z');
    // What the builder shows is what the kernel judges.
    expect(issues(last, { audio: false }).filter((i) => i.level === 'blocker')).toEqual([]);
  });

  it('has no axe violations', async () => {
    const { container } = renderBuilder(sampleReadAloud());
    expect((await axe.run(container, PAGE_RULES)).violations).toEqual([]);
  });
});

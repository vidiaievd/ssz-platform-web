import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/features/profile', () => ({
  useMyProfile: () => ({ data: { displayName: ' Kari Nordmann ' } }),
}));

const { MinimalPairsBuilder } = await import('./builder');
import type { MinimalPairsDocument } from './edits';
import { blankDocument, fakeSources, Intl, sampleMinimalPairs } from './test-support';

function renderBuilder(initial: MinimalPairsDocument) {
  const changes: MinimalPairsDocument[] = [];
  const sources = fakeSources(initial);
  render(
    <Intl>
      <MinimalPairsBuilder
        exerciseId="ex-1"
        initialExercise={initial}
        sources={sources}
        onDocumentChange={(d) => changes.push(d)}
      />
    </Intl>,
  );
  return { user: userEvent.setup(), changes, sources };
}

const tab = (name: string) => screen.getByRole('tab', { name: new RegExp(`^\\d?\\s*${name}`) });

describe('MinimalPairsBuilder — the rail (MP-B27, steps 1–2)', () => {
  it('names the five steps with their subtitles', () => {
    renderBuilder(blankDocument());
    for (const [label, sub] of [
      ['Pairs', 'contrast and words'],
      ['Audio', 'one clip per word'],
      ['Probes', 'how many, how drawn'],
      ['Feedback', 'after the tap'],
      ['Result', 'scoring and memory'],
    ]) {
      expect(tab(label!)).toHaveTextContent(sub!);
    }
  });

  it('colours the dots by the kernel: a pair under two words on step 1', () => {
    const draft = blankDocument();
    renderBuilder(draft);
    expect(within(tab('Pairs')).getByText('1 problem')).toBeInTheDocument();
  });

  it('counts a word without audio on step 2 and nothing on a finished step 1', () => {
    const draft = blankDocument();
    draft.pairs[0]!.words[0]!.text = 'kjære';
    draft.pairs[0]!.words[1]!.text = 'skjære';
    renderBuilder(draft);
    expect(within(tab('Audio')).getByText('2 problems')).toBeInTheDocument();
    expect(within(tab('Pairs')).queryByText(/problem/)).toBeNull();
  });

  it('walks to step 2 and back, and shows the heads of the steps still to come', async () => {
    const { user } = renderBuilder(sampleMinimalPairs());
    await user.click(screen.getByRole('button', { name: /Next: Audio/ }));
    expect(screen.getByRole('heading', { name: 'The recordings' })).toBeInTheDocument();
    await user.click(tab('Probes'));
    expect(screen.getByRole('heading', { name: 'The probe set' })).toBeInTheDocument();
    await user.click(tab('Result'));
    expect(screen.getByText(/Graded on the server, one probe at a time/)).toBeInTheDocument();
    await user.click(tab('Pairs'));
    expect(screen.getByRole('heading', { name: 'Contrast and pairs' })).toBeInTheDocument();
  });

  it("reports every edit and records with the author's name as the voice", async () => {
    const initial = blankDocument();
    initial.pairs[0]!.words[0]!.text = 'kjære';
    initial.pairs[0]!.words[1]!.text = 'skjære';
    const { user, changes, sources } = renderBuilder(initial);
    await user.type(screen.getByLabelText(/^Title/), 'K');
    expect(changes[changes.length - 1]!.title).toBe('K');

    await user.click(tab('Audio'));
    await user.click(screen.getAllByRole('button', { name: 'Record' })[0]!);
    await user.click(screen.getByRole('button', { name: 'Stopp' }));
    await vi.waitFor(() => expect(sources.upload).toHaveBeenCalled());
    await vi.waitFor(() =>
      expect(changes[changes.length - 1]!.pairs[0]!.words[0]!.clip.voice).toBe('Kari Nordmann'),
    );
  });
});

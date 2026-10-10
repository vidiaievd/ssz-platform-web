import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/features/profile', () => ({
  useMyProfile: () => ({ data: { displayName: ' Kari Nordmann ' } }),
}));

vi.mock('../../actions/minimal-pairs', () => ({ saveMinimalPairsAction: vi.fn() }));

const { MinimalPairsBuilder } = await import('./builder');
const { saveMinimalPairsAction } = await import('../../actions/minimal-pairs');
import type { MinimalPairsDocument } from './edits';
import { blankDocument, fakeSources, Intl, sampleMinimalPairs } from './test-support';

function renderBuilder(initial: MinimalPairsDocument) {
  const changes: MinimalPairsDocument[] = [];
  const sources = fakeSources(initial);
  render(
    <Intl>
      <MinimalPairsBuilder
        exerciseId="ex-1"
        containerId="module-1"
        initialExercise={initial}
        sources={sources}
        onDocumentChange={(d) => changes.push(d)}
      />
    </Intl>,
  );
  return { user: userEvent.setup(), changes, sources };
}

const tab = (name: string) => screen.getByRole('tab', { name: new RegExp(`^\\d?\\s*${name}`) });

describe('MinimalPairsBuilder — the rail (MP-B27)', () => {
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

  it('walks the five steps and back', async () => {
    const { user } = renderBuilder(sampleMinimalPairs());
    await user.click(screen.getByRole('button', { name: /Next: Audio/ }));
    expect(screen.getByRole('heading', { name: 'The recordings' })).toBeInTheDocument();
    await user.click(tab('Probes'));
    expect(screen.getByRole('heading', { name: 'The probe set' })).toBeInTheDocument();
    await user.click(tab('Result'));
    expect(screen.getByRole('heading', { name: 'Result and memory' })).toBeInTheDocument();
    await user.click(tab('Feedback'));
    expect(screen.getByRole('heading', { name: 'What happens after the tap' })).toBeInTheDocument();
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

describe('MinimalPairsBuilder — the gate (MP-B28)', () => {
  async function openGate(user: ReturnType<typeof userEvent.setup>) {
    await user.click(tab('Result'));
    await user.click(screen.getByRole('button', { name: 'Review & finish' }));
    return screen.findByRole('dialog');
  }

  it('lists a blank draft’s blockers with the fix label, and no passes it cannot claim', async () => {
    const { user } = renderBuilder(blankDocument());
    const dialog = await openGate(user);
    expect(within(dialog).getByText(/Pair 1 has fewer than two words/)).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: /Fix \d+ problems? first/ })).toBeDisabled();
    expect(within(dialog).queryByText(/usable pair/)).toBeNull();
  });

  it('goes to the step that owns a finding', async () => {
    const { user } = renderBuilder(blankDocument());
    const dialog = await openGate(user);
    const rows = within(dialog)
      .getAllByRole('button')
      .filter((b) => b.textContent?.includes('Write both words'));
    await user.click(rows[0]!);
    expect(tab('Pairs')).toHaveAttribute('aria-selected', 'true');
  });

  it('restates the author’s own numbers for a finished set, honestly about memory', async () => {
    const { user } = renderBuilder(sampleMinimalPairs());
    const dialog = await openGate(user);
    expect(within(dialog).getByText(/4 usable pairs, 9 words, 9 recordings/)).toBeInTheDocument();
    expect(within(dialog).getByText(/12 probes drawn balanced per attempt/)).toBeInTheDocument();
    expect(
      within(dialog).getByText(/2 replays per probe · immediate verdict with A\/B on a miss/),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText('Graded on the server against the option id · pass at 75%'),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText(
        /Rates contrast:kjsj · contrast:consonant only; the words get an exposure event, no rating — stored, not yet written/,
      ),
    ).toBeInTheDocument();
    expect(within(dialog).getByText('No synthetic speech in the set')).toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: /Fix \d+ problems? first/ })).toBeNull();
  });
});

describe('MinimalPairsBuilder — saved as the author works (MP-B27)', () => {
  it('writes an edit once, with the token the row carried, and says so', async () => {
    vi.mocked(saveMinimalPairsAction).mockResolvedValue({
      ok: true,
      value: { status: 'saved', updatedAt: '2026-10-10T10:05:00.000Z' },
    });
    const { user } = renderBuilder(sampleMinimalPairs());
    expect(saveMinimalPairsAction).not.toHaveBeenCalled();
    await user.type(screen.getByLabelText(/^Title/), '!');
    await vi.waitFor(() => expect(saveMinimalPairsAction).toHaveBeenCalledTimes(1), {
      timeout: 3000,
    });
    const [exerciseId, containerId, input] = vi.mocked(saveMinimalPairsAction).mock.calls[0]!;
    expect([exerciseId, containerId]).toEqual(['ex-1', 'module-1']);
    expect(input.expectedUpdatedAt).toBe('2026-10-10T10:00:00.000Z');
    expect(input.content.title).toMatch(/!$/);
    expect(await screen.findByText(/^Saved/)).toBeInTheDocument();
  });

  it('offers the undo of everything since the page opened', async () => {
    vi.mocked(saveMinimalPairsAction).mockResolvedValue({
      ok: true,
      value: { status: 'saved', updatedAt: 't1' },
    });
    const { user } = renderBuilder(sampleMinimalPairs());
    expect(
      screen.queryByRole('button', { name: /Undo everything since I opened this/ }),
    ).toBeNull();
    await user.type(screen.getByLabelText(/^Title/), '!');
    await user.click(
      await screen.findByRole('button', { name: /Undo everything since I opened this/ }),
    );
    await user.click(screen.getByRole('button', { name: 'Put it back' }));
    expect(screen.getByLabelText(/^Title/)).toHaveValue(sampleMinimalPairs().title);
  });
});

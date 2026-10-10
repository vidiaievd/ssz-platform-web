import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { describe, expect, it, vi } from 'vitest';

import { SAMPLE_FIELD_IDS } from '@/lib/shared-kernel/information-transfer';

import type { InformationTransferDocument } from './edits';
import { Intl, LOADED_AT, PAGE_RULES, blankDocument, sampleDocument } from './test-support';

vi.mock('@/features/media', () => ({
  useMediaAsset: () => ({ data: undefined }),
  uploadAsset: vi.fn(),
}));
vi.mock('../../actions/information-transfer', () => ({ saveInformationTransferAction: vi.fn() }));
vi.mock('../../api/use-exercise-targets', () => ({
  useExerciseTargets: () => ({
    data: {
      exerciseId: 'ex-1',
      templateCode: 'information_transfer',
      addressable: true,
      items: [
        {
          itemKey: 'f6navn',
          label: 'Kontaktperson',
          targets: [
            {
              atomType: 'vocabulary_item',
              atomId: 'w1',
              role: 'focus',
              atomTitle: 'kontaktperson',
              track: null,
              broken: null,
            },
          ],
        },
        // A word atom on a price is not a word of the form — never named.
        {
          itemKey: 'f4pris',
          label: 'Pris',
          targets: [
            {
              atomType: 'vocabulary_item',
              atomId: 'w2',
              role: 'focus',
              atomTitle: 'krone',
              track: null,
              broken: null,
            },
          ],
        },
      ],
    },
  }),
}));

const { InformationTransferBuilder } = await import('./builder');
const { saveInformationTransferAction } = await import('../../actions/information-transfer');

function draw(
  initial: InformationTransferDocument,
  onDocumentChange?: (d: InformationTransferDocument) => void,
) {
  const view = render(
    <Intl>
      <InformationTransferBuilder
        exerciseId="ex-1"
        containerId="module-1"
        initialExercise={initial}
        {...(onDocumentChange === undefined ? {} : { onDocumentChange })}
      />
    </Intl>,
  );
  return { user: userEvent.setup(), ...view };
}

const tab = (name: RegExp) => screen.getByRole('tab', { name });

describe('InformationTransferBuilder — the rail (INF-B27)', () => {
  it('lists the five steps with their sub-lines', () => {
    draw(sampleDocument());
    for (const label of [
      /Source.*text or recording/,
      /Blank.*the fields/,
      /Answers.*what counts as right/,
      /Delivery.*how it is played/,
      /Result.*scoring and memory/,
    ]) {
      expect(tab(label)).toBeInTheDocument();
    }
  });

  it('shows a blank draft its blockers on the rail from the first mount — steps 1 and 2', () => {
    draw(blankDocument());
    expect(tab(/^1\s*Source/)).toHaveTextContent(/1 problem/);
    expect(tab(/^2\s*Blank/)).toHaveTextContent(/problem/);
  });

  it('shows a finished recording with no blockers anywhere', () => {
    draw(sampleDocument('audio'));
    for (const n of [1, 2, 3, 4, 5]) {
      expect(tab(new RegExp(`^${n}`))).not.toHaveTextContent(/problem/);
    }
  });

  it('puts a hidden written source on step 4 as a blocker', () => {
    const doc = sampleDocument('text');
    doc.answering = { ...doc.answering, showSource: 'afterAnswer' };
    draw(doc);
    expect(tab(/^4\s*Delivery/)).toHaveTextContent(/1 problem/);
  });

  it('walks all five steps forward and back', async () => {
    const { user } = draw(sampleDocument());
    expect(screen.getByRole('heading', { name: 'The source' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Next: Blank/ }));
    expect(screen.getByRole('heading', { name: 'The blank' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Next: Answers/ }));
    expect(
      screen.getByRole('heading', { name: 'What counts as the same answer' }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Next: Delivery/ }));
    expect(screen.getByRole('heading', { name: 'How it is played' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Next: Result/ }));
    expect(screen.getByRole('heading', { name: 'Result and memory' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Back/ }));
    expect(screen.getByRole('heading', { name: 'How it is played' })).toBeInTheDocument();
  });

  it('reports every edit to the page', async () => {
    const seen: InformationTransferDocument[] = [];
    const { user } = draw(blankDocument(), (d) => seen.push(d));
    await user.type(screen.getByLabelText(/^Title/), 'Skjema');
    expect(seen.at(-1)?.title).toBe('Skjema');
  });

  it('names the lexical cells’ word atoms on step 5, and only theirs', async () => {
    const { user } = draw(sampleDocument());
    await user.click(tab(/^5\s*Result/));
    expect(screen.getByText('kontaktperson')).toBeInTheDocument();
    expect(screen.queryByText(/krone/)).toBeNull();
  });

  it('has no accessibility violations', async () => {
    const { container } = draw(sampleDocument('audio'));
    expect((await axe.run(container, PAGE_RULES)).violations).toEqual([]);
  });
});

describe('InformationTransferBuilder — the gate (INF-B28)', () => {
  async function openGate(user: ReturnType<typeof userEvent.setup>) {
    await user.click(tab(/^5\s*Result/));
    await user.click(screen.getByRole('button', { name: 'Review & finish' }));
    return screen.findByRole('dialog');
  }

  it('lists a blank draft’s blockers with the fix label and refuses to finish', async () => {
    const { user } = draw(blankDocument());
    const dialog = await openGate(user);
    expect(within(dialog).getByText(/No source text/)).toBeInTheDocument();
    expect(within(dialog).getByText('Paste the notice or schedule')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: /Fix \d+ problems? first/ })).toBeDisabled();
    expect(within(dialog).queryByText(/each with an id/)).toBeNull();
  });

  it('goes to the step that owns a finding', async () => {
    const doc = sampleDocument('text');
    doc.answering = { ...doc.answering, showSource: 'afterAnswer' };
    const { user } = draw(doc);
    const dialog = await openGate(user);
    await user.click(within(dialog).getByText('Keep the text visible'));
    expect(tab(/^4\s*Delivery/)).toHaveAttribute('aria-selected', 'true');
  });

  it('restates the author’s own settings for a finished recording', async () => {
    const { user } = draw(sampleDocument('audio'));
    const dialog = await openGate(user);
    for (const line of [
      '6 cells, each with an id, an expected answer and an explanation',
      'Graded on the server, cell by cell · partial credit · pass at 75%',
      'Formats normalised in the core for 5 cells, spelled-out numerals included — from the Norsk (bokmål) pack',
      'Audio source · 2 playbacks · a fragment per cell, free of charge',
      'Rates skill:selective_listening; lexical cells: exposure is stored, not yet written',
      'itemKey = fieldId · ExerciseItemTarget addresses each cell on its own',
    ]) {
      expect(within(dialog).getByText(line)).toBeInTheDocument();
    }
    // The kernel's notes, and the two closing paragraphs.
    expect(
      within(dialog).getByText(/its own review schedule arrives after plan 63/),
    ).toBeInTheDocument();
    expect(within(dialog).getByText(/^Evidence: success ceiling medium/)).toBeInTheDocument();
    expect(within(dialog).getByText('information-transfer.validator.ts')).toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: /Fix \d+ problems? first/ })).toBeNull();
  });

  it('says a text source and «nothing» honestly', async () => {
    const doc = sampleDocument('text');
    doc.scoring = { ...doc.scoring, memory: 'none' };
    doc.grading = { ...doc.grading, requiredAll: true };
    const { user } = draw(doc);
    const dialog = await openGate(user);
    expect(
      within(dialog).getByText('Text source, visible while the form is filled'),
    ).toBeInTheDocument();
    expect(within(dialog).getByText('Writes nothing to memory')).toBeInTheDocument();
    expect(
      within(dialog).getByText(
        'Graded on the server, cell by cell · partial credit · pass at 75% and every required cell right',
      ),
    ).toBeInTheDocument();
  });

  it('reads formats from digits only in a course without a pack (Q2-A)', async () => {
    const doc = sampleDocument('text');
    doc.language = 'de';
    const { user } = draw(doc);
    const dialog = await openGate(user);
    expect(within(dialog).getByText(/for 5 cells — from digits only/)).toBeInTheDocument();
  });
});

describe('InformationTransferBuilder — saved as the author works', () => {
  it('writes an edit once, with both columns and the token the row carried', async () => {
    vi.mocked(saveInformationTransferAction).mockResolvedValue({
      ok: true,
      value: { status: 'saved', updatedAt: '2026-10-10T10:05:00.000Z' },
    });
    const { user } = draw(sampleDocument());
    expect(saveInformationTransferAction).not.toHaveBeenCalled();
    await user.type(screen.getByLabelText(/^Title/), '!');
    await vi.waitFor(() => expect(saveInformationTransferAction).toHaveBeenCalledTimes(1), {
      timeout: 3000,
    });
    const [exerciseId, containerId, input] = vi.mocked(saveInformationTransferAction).mock
      .calls[0]!;
    expect([exerciseId, containerId]).toEqual(['ex-1', 'module-1']);
    expect(input.expectedUpdatedAt).toBe(LOADED_AT);
    expect(input.content.title).toMatch(/!$/);
    // The key is only in the answers column, keyed by field id.
    expect(input.expectedAnswers.fields[SAMPLE_FIELD_IDS[1]]!.expected).toEqual(['17:30']);
    expect(JSON.stringify(input.content)).not.toContain('Halv seks');
    expect(await screen.findByText(/^Saved/)).toBeInTheDocument();
  });

  it('offers the undo of everything since the page opened', async () => {
    vi.mocked(saveInformationTransferAction).mockResolvedValue({
      ok: true,
      value: { status: 'saved', updatedAt: 't1' },
    });
    const { user } = draw(sampleDocument());
    await user.type(screen.getByLabelText(/^Title/), '!');
    await user.click(
      await screen.findByRole('button', { name: /Undo everything since I opened this/ }),
    );
    await user.click(screen.getByRole('button', { name: 'Put it back' }));
    expect(screen.getByLabelText(/^Title/)).toHaveValue(sampleDocument().title);
  });
});

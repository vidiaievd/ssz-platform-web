import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';

import {
  emptyProsodyLayer,
  layerOf,
  type ProsodyLayer,
  type WordStress,
} from '@/lib/shared-kernel/prosody';

import { Intl, PAGE_RULES } from '../read-aloud/test-support';
import { ProsodyEditor, type EditorNeed, type ProsodySuggestion } from './prosody-editor';

const TEXT = 'Bartek har jobbet i tre år. Han trives godt.';

/** The dictionary's word: `jobbet`, tone 2 on the first «o». */
const JOBBET: WordStress = {
  i: 2,
  w: 'jobbet',
  toneme: 2,
  vowel: { s: 1, e: 2, long: false },
  source: 'lexicon',
};

function Host({
  needs = [],
  initial = emptyProsodyLayer(),
  onSuggest,
  onLayer,
}: {
  needs?: EditorNeed[];
  initial?: ProsodyLayer;
  onSuggest?: () => Promise<ProsodySuggestion>;
  onLayer?: (l: ProsodyLayer) => void;
}) {
  const [layer, setLayer] = useState(initial);
  return (
    <Intl>
      <ProsodyEditor
        text={TEXT}
        layer={layer}
        lexicon={{ stresses: [JOBBET], unresolved: [{ i: 0, w: 'Bartek' }] }}
        needs={needs}
        lang="nb"
        onSuggest={onSuggest}
        onChange={(next) => {
          onLayer?.(next);
          setLayer(next);
        }}
      />
    </Intl>
  );
}

function setup(props: Parameters<typeof Host>[0] = {}) {
  let last: ProsodyLayer = props.initial ?? emptyProsodyLayer();
  const view = render(<Host {...props} onLayer={(l) => (last = l)} />);
  return { ...view, user: userEvent.setup(), layer: () => last };
}

const canvas = () => screen.getByLabelText('Sentence 1');

describe('ProsodyEditor (plan 86, step 6h.3b)', () => {
  it('lists the sentences with what each still needs', () => {
    setup({
      needs: [
        { kind: 'word', i: 0 },
        { kind: 'end', sentence: 0 },
      ],
    });
    const list = screen.getByRole('list', { name: 'Sentences of the passage' });
    const rows = within(list).getAllByRole('button');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('2 to fix');
    expect(rows[1]).toHaveTextContent('✓');
  });

  it('draws the dictionary’s toneme on the sentence', () => {
    setup();
    const jobbet = within(canvas()).getByRole('button', { name: 'jobbet' });
    expect(jobbet.querySelector('[data-sign="2"]')).not.toBeNull();
  });

  it('cycles the pause after a word from the gap', async () => {
    const { user, layer } = setup();
    const gap = screen.getByRole('button', { name: 'Pause after «har»' });
    await user.click(gap);
    expect(layer().boundaries).toEqual([
      { i: 1, w: 'har', pitch: null, pause: 'short', source: 'teacher' },
    ]);
    await user.click(gap);
    expect(layer().boundaries[0]?.pause).toBe('long');
    await user.click(gap);
    expect(layer().boundaries).toEqual([]);
  });

  it('ends a group and sets the main word from the keyboard', async () => {
    const { user, layer } = setup();
    const ar = within(canvas()).getByRole('button', { name: 'år' });
    ar.focus();
    await user.keyboard('.');
    expect(layer().boundaries).toEqual([
      { i: 5, w: 'år', pitch: 'fall', pause: 'long', source: 'teacher' },
    ]);
    // The first Enter only picks the word (the `.` did already), the next toggles the accent.
    await user.keyboard('{Enter}');
    expect(layer().accents).toEqual([{ i: 5, w: 'år', source: 'teacher' }]);
    await user.keyboard('{Delete}');
    expect(layer().accents).toEqual([]);
    expect(layer().boundaries).toEqual([]);
  });

  it('settles a word the dictionary does not know from its card', async () => {
    const { user, layer } = setup();
    await user.click(within(canvas()).getByRole('button', { name: 'Bartek' }));
    const card = screen.getByRole('region', { name: 'Marks of «Bartek»' });
    expect(card).toHaveTextContent(/Not in the dictionary/);
    await user.click(
      within(within(card).getByRole('group', { name: 'Stressed vowel' })).getByRole('button', {
        name: 'no stress',
      }),
    );
    expect(layer().unstressed).toEqual([{ i: 0, w: 'Bartek', source: 'teacher' }]);
    await user.click(within(card).getByRole('button', { name: 'Back to the dictionary' }));
    expect(layer().unstressed).toEqual([]);
  });

  it('overrides the dictionary’s toneme and keeps its vowel', async () => {
    const { user, layer } = setup();
    await user.click(within(canvas()).getByRole('button', { name: 'jobbet' }));
    const card = screen.getByRole('region', { name: 'Marks of «jobbet»' });
    expect(card).toHaveTextContent('Dictionary: tone 2, stressed «o»');
    await user.click(
      within(within(card).getByRole('group', { name: 'Toneme' })).getByRole('button', {
        name: '╱ 1',
      }),
    );
    expect(layer().stresses).toEqual([
      { i: 2, w: 'jobbet', toneme: 1, vowel: { s: 1, e: 2, long: false }, source: 'teacher' },
    ]);
  });

  it('opens another sentence from the list', async () => {
    const { user } = setup();
    const list = screen.getByRole('list', { name: 'Sentences of the passage' });
    await user.click(within(list).getAllByRole('button')[1]!);
    expect(screen.getByLabelText('Sentence 2')).toHaveTextContent('Han trives godt.');
  });

  it('has no axe violations with a word picked', async () => {
    const { user, container } = setup({ needs: [{ kind: 'word', i: 0 }] });
    await user.click(within(canvas()).getByRole('button', { name: 'Bartek' }));
    expect((await axe.run(container, PAGE_RULES)).violations).toEqual([]);
  });
});

describe('ProsodyEditor — as text, ✦ and orphans (plan 86, step 6h.3c)', () => {
  const field = () => screen.getByRole('textbox', { name: 'The passage with its marks' });

  it('edits the marks as text and says where a notation went wrong', async () => {
    const { user, layer } = setup();
    await user.click(screen.getByRole('button', { name: 'As text' }));
    expect(field()).toHaveValue(TEXT);

    await user.clear(field());
    await user.type(field(), "'0Bartek har jobbet i tre ^år. Han trives godt.");
    expect(layer().unstressed).toEqual([{ i: 0, w: 'Bartek', source: 'teacher' }]);
    expect(layer().accents).toEqual([{ i: 5, w: 'år', source: 'teacher' }]);

    await user.type(field(), '\n\\');
    expect(screen.getByRole('alert')).toHaveTextContent(/Line 2, character 1:.*starts a line/);
    // Nothing was applied from the broken notation.
    expect(layer().accents).toEqual([{ i: 5, w: 'år', source: 'teacher' }]);

    await user.click(screen.getByRole('button', { name: 'Visually' }));
    expect(
      within(canvas()).getByRole('button', { name: 'år' }).querySelector('[data-focus]'),
    ).not.toBeNull();
  });

  it('proposes the AI marks per sentence, dashed, and takes them as `ai`', async () => {
    const suggested = layerOf([
      { kind: 'boundary', mark: { i: 5, w: 'år', pitch: 'fall', pause: 'long', source: 'ai' } },
      { kind: 'boundary', mark: { i: 8, w: 'godt', pitch: 'fall', pause: 'long', source: 'ai' } },
    ]);
    const { user, layer } = setup({
      onSuggest: () => Promise.resolve({ status: 'suggested', text: TEXT, layer: suggested }),
    });
    await user.click(screen.getByRole('button', { name: 'Suggest marks' }));
    expect(await screen.findByText(/2 sentences have a suggestion/)).toBeInTheDocument();

    const box = screen.getByRole('region', { name: 'AI suggestion for this sentence' });
    expect(box.querySelector('[data-mark="boundary"][data-source="ai"]')).not.toBeNull();
    await user.click(within(box).getByRole('button', { name: 'Accept in this sentence' }));
    expect(layer().boundaries).toEqual([
      { i: 5, w: 'år', pitch: 'fall', pause: 'long', source: 'ai' },
    ]);
    // The accepted mark stays the agent's, and is drawn as such, until the author touches it.
    expect(canvas().querySelector('[data-mark="boundary"][data-source="ai"]')).not.toBeNull();
    expect(screen.getByText(/1 sentence has a suggestion/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Reject all' }));
    expect(screen.queryByText(/has a suggestion/)).not.toBeInTheDocument();
    expect(layer().boundaries).toHaveLength(1);
  });

  it('says why the agent refused', async () => {
    const { user } = setup({
      onSuggest: () => Promise.resolve({ status: 'refused', reason: 'pool_empty' }),
    });
    await user.click(screen.getByRole('button', { name: 'Suggest marks' }));
    expect(
      await screen.findByText('The AI credits for this month are used up.'),
    ).toBeInTheDocument();
  });

  it('has no ✦ without the owner’s permission', () => {
    setup();
    expect(screen.queryByRole('button', { name: 'Suggest marks' })).not.toBeInTheDocument();
  });

  it('puts an orphan back on a picked word, or removes it', async () => {
    const initial = layerOf(
      [],
      [
        { kind: 'accent', mark: { i: 9, w: 'år', source: 'teacher' } },
        { kind: 'boundary', mark: { i: 9, w: 'før', pitch: 'rise', pause: null, source: 'ai' } },
      ],
    );
    const { user, layer } = setup({ initial });
    const strip = screen.getByRole('region', { name: 'Marks without a word' });
    expect(strip).toHaveTextContent('main word «år»');
    expect(strip).toHaveTextContent('group end ↗ after «før»');

    await user.click(within(strip).getAllByRole('button', { name: 'Put back on a word' })[0]!);
    expect(screen.getByRole('status')).toHaveTextContent(/Click the word the mark goes on/);
    await user.click(within(canvas()).getByRole('button', { name: 'år' }));
    expect(layer().accents).toEqual([{ i: 5, w: 'år', source: 'teacher' }]);
    expect(layer().orphans).toHaveLength(1);

    await user.click(screen.getByRole('button', { name: 'Remove' }));
    expect(layer().orphans).toEqual([]);
    expect(screen.queryByRole('region', { name: 'Marks without a word' })).not.toBeInTheDocument();
  });

  it('has no axe violations as text, with a proposal and with orphans', async () => {
    const { user, container } = setup({
      initial: layerOf([], [{ kind: 'accent', mark: { i: 9, w: 'år', source: 'teacher' } }]),
      onSuggest: () =>
        Promise.resolve({
          status: 'suggested',
          text: TEXT,
          layer: layerOf([{ kind: 'accent', mark: { i: 5, w: 'år', source: 'ai' } }]),
        }),
    });
    await user.click(screen.getByRole('button', { name: 'Suggest marks' }));
    await screen.findByRole('region', { name: 'AI suggestion for this sentence' });
    expect((await axe.run(container, PAGE_RULES)).violations).toEqual([]);
    await user.click(screen.getByRole('button', { name: 'As text' }));
    expect((await axe.run(container, PAGE_RULES)).violations).toEqual([]);
  });
});

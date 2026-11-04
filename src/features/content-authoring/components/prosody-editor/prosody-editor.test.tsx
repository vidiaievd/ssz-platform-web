import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';

import { emptyProsodyLayer, type ProsodyLayer, type WordStress } from '@/lib/shared-kernel/prosody';

import { Intl, PAGE_RULES } from '../read-aloud/test-support';
import { ProsodyEditor, type EditorNeed } from './prosody-editor';

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
  onLayer,
}: {
  needs?: EditorNeed[];
  onLayer?: (l: ProsodyLayer) => void;
}) {
  const [layer, setLayer] = useState(emptyProsodyLayer());
  return (
    <Intl>
      <ProsodyEditor
        text={TEXT}
        layer={layer}
        lexicon={{ stresses: [JOBBET], unresolved: [{ i: 0, w: 'Bartek' }] }}
        needs={needs}
        lang="nb"
        onChange={(next) => {
          onLayer?.(next);
          setLayer(next);
        }}
      />
    </Intl>
  );
}

function setup(props: Parameters<typeof Host>[0] = {}) {
  let last: ProsodyLayer = emptyProsodyLayer();
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

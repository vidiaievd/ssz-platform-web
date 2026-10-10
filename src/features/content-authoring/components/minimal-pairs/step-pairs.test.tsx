import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { describe, expect, it } from 'vitest';

import { emptyContent, newPair, newWord } from '@/lib/shared-kernel/minimal-pairs';

import type { MinimalPairsDocument } from './edits';
import { StepPairs } from './step-pairs';
import { blankDocument, documentOf, Harness, PAGE_RULES, sampleMinimalPairs } from './test-support';

function renderStep(initial: MinimalPairsDocument) {
  const changes: MinimalPairsDocument[] = [];
  const view = render(
    <Harness initial={initial} step={StepPairs} onChange={(next) => changes.push(next)} />,
  );
  return { user: userEvent.setup(), changes, last: () => changes[changes.length - 1]!, ...view };
}

const family = (label: string) => screen.getByRole('button', { name: new RegExp(`^${label}`) });

describe('StepPairs — the contrast (MP-B1, MP-B2)', () => {
  it('offers the five families of the pack with their synthesis policy', () => {
    renderStep(blankDocument());
    const grid = screen.getByRole('group', { name: 'Contrast' });
    expect(within(grid).getAllByRole('button')).toHaveLength(5);
    expect(family('kj / sj')).toHaveAttribute('aria-pressed', 'true');
    expect(family('kj / sj')).toHaveTextContent('ingen syntetisk tale');
    expect(family('Lengde')).toHaveTextContent('syntetisk tale: sjekk hver fil');
    expect(family('Konsonant')).toHaveTextContent('syntetisk tale tillatt');
    // The author's explanation, in the author's language.
    expect(family('kj / sj')).toHaveTextContent(/disappearing among younger Norwegian speakers/);
  });

  it('says what the chosen family means under the grid — a warning where synthesis is barred', async () => {
    const { user, last } = renderStep(blankDocument());
    expect(
      screen.getByText(/Russian and Ukrainian speakers hear both/).closest('[data-tone]'),
    ).toHaveAttribute('data-tone', 'warn');
    await user.click(family('Vokalkvalitet'));
    expect(last().contrastId).toBe('vowel');
    expect(screen.getByText(/The y\/u\/i triangle/).closest('[data-tone]')).toHaveAttribute(
      'data-tone',
      'tip',
    );
  });

  it('shows a notice, not Norwegian families, for a course without a pack', () => {
    renderStep(documentOf(emptyContent('sv')));
    expect(screen.queryByRole('group', { name: 'Contrast' })).toBeNull();
    expect(
      screen.getByText(/no contrast families for this course's language yet \(sv\)/),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /From the library/ })).toBeDisabled();
  });

  it('takes the title and the instruction, with the pack placeholders', async () => {
    const { user, last } = renderStep(blankDocument());
    const title = screen.getByLabelText(/^Title/);
    expect(title).toHaveAttribute('placeholder', 'Hører du kj eller sj?');
    await user.type(title, 'Kj eller sj');
    expect(last().title).toBe('Kj eller sj');
    await user.type(screen.getByLabelText('Instruction to the student'), 'Trykk');
    expect(last().instruction).toBe('Trykk');
  });
});

describe('StepPairs — the pairs (MP-B3…B7)', () => {
  it('counts pairs and playable words in the section head', () => {
    renderStep(sampleMinimalPairs());
    expect(screen.getByRole('heading', { name: '4 pairs · 9 playable words' })).toBeInTheDocument();
  });

  it('writes the words of a pair and names the card after them', async () => {
    const { user, last } = renderStep(blankDocument());
    const card = screen.getByRole('region', { name: 'New pair' });
    await user.type(within(card).getByLabelText('Word A of Pair 1'), 'kjære');
    await user.type(screen.getByLabelText('Word B of Pair 1'), 'skjære');
    await user.type(screen.getByLabelText('Meaning of word B of Pair 1'), 'å skjære');
    await user.type(screen.getByLabelText('IPA of word A of Pair 1'), 'ç');
    expect(last().pairs[0]!.words.map((w) => [w.text, w.gloss, w.ipa])).toEqual([
      ['kjære', '', 'ç'],
      ['skjære', 'å skjære', ''],
    ]);
    expect(screen.getByRole('region', { name: 'kjære · skjære' })).toBeInTheDocument();
  });

  it('adds a third word and stops there; removing comes back at three', async () => {
    const { user, last } = renderStep(blankDocument());
    const third = screen.getByRole('button', { name: 'Third word' });
    expect(screen.getByRole('button', { name: 'Remove word A of Pair 1' })).toBeDisabled();
    await user.click(third);
    expect(last().pairs[0]!.words).toHaveLength(3);
    expect(third).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Remove word C of Pair 1' }));
    expect(last().pairs[0]!.words).toHaveLength(2);
  });

  it('adds and deletes pairs, never the last one', async () => {
    const { user, last } = renderStep(blankDocument());
    expect(screen.getByRole('button', { name: 'Delete pair — Pair 1' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Add pair' }));
    expect(last().pairs).toHaveLength(2);
    await user.click(screen.getByRole('button', { name: 'Delete pair — Pair 2' }));
    expect(last().pairs).toHaveLength(1);
  });

  it('marks a pair training another contrast, and clears it back to the exercise one', async () => {
    const { user, last } = renderStep(sampleMinimalPairs());
    // The sample's fourth pair is «consonant» in a «kj / sj» set.
    const fourth = screen.getByRole('region', { name: /kjøre · kjøpe/ });
    expect(
      within(fourth).getByTitle('Different contrast from the rest of the set'),
    ).toHaveTextContent('Konsonant');
    const contrast = within(fourth).getByRole('radiogroup', { name: 'Contrast of Pair 4' });
    await user.click(within(contrast).getByRole('radio', { name: 'kj / sj' }));
    expect(last().pairs[3]!.contrastId).toBe('');
    expect(within(fourth).queryByTitle('Different contrast from the rest of the set')).toBeNull();
  });

  it('keeps the teacher note on the pair', async () => {
    const { user, last } = renderStep(blankDocument());
    await user.type(screen.getByLabelText('Note for the teacher'), 'Fra leksjon 2');
    expect(last().pairs[0]!.note).toBe('Fra leksjon 2');
  });

  it('draws a pair under two words red and says why in the card', () => {
    const { container } = renderStep(blankDocument());
    const card = container.querySelector('section[data-bad="true"]')!;
    expect(card).not.toBeNull();
    expect(
      within(card as HTMLElement).getByText(/Pair 1 has fewer than two words/),
    ).toBeInTheDocument();
  });

  it('reports a duplicate spelling on its pair', () => {
    const doc = blankDocument();
    doc.pairs = [{ ...newPair(), words: [newWord('kjekk'), newWord('Kjekk')] }];
    renderStep(doc);
    expect(screen.getByText(/Pair 1 repeats the same spelling twice/)).toBeInTheDocument();
  });

  it('has no axe violations', async () => {
    const { container } = renderStep(sampleMinimalPairs());
    expect((await axe.run(container, PAGE_RULES)).violations).toEqual([]);
  });
});

describe('StepPairs — the library (MP-B8, Q2-A)', () => {
  it('lists the pack pairs for the contrast, all without audio', async () => {
    const { user } = renderStep(blankDocument());
    await user.click(screen.getByRole('button', { name: /From the library/ }));
    const dialog = screen.getByRole('dialog', { name: 'Pair library — kj / sj' });
    const items = within(dialog)
      .getAllByRole('button')
      .filter((b) => b.textContent?.includes('/'));
    expect(items).toHaveLength(5);
    expect(within(dialog).getAllByText('uten lyd')).toHaveLength(5);
    expect(within(dialog).queryByText('opptak finnes')).toBeNull();
  });

  it('inserts a pair in place of the empty ones and closes', async () => {
    const { user, last } = renderStep(blankDocument());
    await user.click(screen.getByRole('button', { name: /From the library/ }));
    await user.click(screen.getByRole('button', { name: /kjekk\s*\/\s*sjekk/ }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(last().pairs.map((p) => p.words.map((w) => w.text))).toEqual([['kjekk', 'sjekk']]);
  });

  it('shows a pair already in the set as such, and does not insert it twice', async () => {
    const { user } = renderStep(sampleMinimalPairs());
    await user.click(screen.getByRole('button', { name: /From the library/ }));
    const already = screen.getByRole('button', { name: /kjære\s*\/\s*skjære/ });
    expect(already).toBeDisabled();
    expect(already).toHaveTextContent('already in the set');
  });
});

import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';

import { renderWithProviders } from '@/test/render';
import type { ExerciseDisplay } from '../types';
import { ExercisePreview } from './exercise-preview';

const base = {
  id: 'ex1',
  targetLanguage: 'nb',
  difficultyLevel: 'A2' as const,
  instructions: null,
};

describe('ExercisePreview — new exercise types', () => {
  it('renders a short_answer question and an answer placeholder', () => {
    const exercise: ExerciseDisplay = {
      ...base,
      templateCode: 'short_answer',
      content: { question: 'Når hørte Anne nyhetene?', context: 'Tekst 19A' },
    };
    renderWithProviders(<ExercisePreview exercise={exercise} />);

    expect(screen.getByText('Når hørte Anne nyhetene?')).toBeInTheDocument();
    expect(screen.getByText('Tekst 19A')).toBeInTheDocument();
    // Answer affordance label from the Content namespace (en).
    expect(screen.getByText('Answer')).toBeInTheDocument();
  });

  it('renders a writing_task prompt and its topic titles', () => {
    const exercise: ExerciseDisplay = {
      ...base,
      templateCode: 'writing_task',
      content: {
        prompt: 'Skriv et kort leserinnlegg.',
        options: [
          { id: 'a', title: 'Gratis norskkurs til alle', body: '...' },
          { id: 'b', title: 'Tog skal bli billigere' },
        ],
      },
    };
    renderWithProviders(<ExercisePreview exercise={exercise} />);

    expect(screen.getByText('Skriv et kort leserinnlegg.')).toBeInTheDocument();
    expect(screen.getByText('Gratis norskkurs til alle')).toBeInTheDocument();
    expect(screen.getByText('Tog skal bli billigere')).toBeInTheDocument();
  });

  it('renders a sentence_schema sentence, field labels and token chips', () => {
    const exercise: ExerciseDisplay = {
      ...base,
      templateCode: 'sentence_schema',
      content: {
        sentence: 'Lars har aldri likt Lotte.',
        fields: [
          { id: 'forfelt', label: 'Forfelt' },
          { id: 'verbal1', label: 'Verbal' },
        ],
        tokens: [
          { id: 't1', text: 'Lars' },
          { id: 't2', text: 'har' },
        ],
      },
    };
    renderWithProviders(<ExercisePreview exercise={exercise} />);

    expect(screen.getByText('Lars har aldri likt Lotte.')).toBeInTheDocument();
    expect(screen.getByText('Forfelt')).toBeInTheDocument();
    expect(screen.getByText('Verbal')).toBeInTheDocument();
    // Tokens rendered as chips.
    expect(screen.getByText('Lars')).toBeInTheDocument();
    expect(screen.getByText('har')).toBeInTheDocument();
  });

  it('renders error_correction sentences as the student meets them, without the answers', () => {
    const exercise: ExerciseDisplay = {
      ...base,
      templateCode: 'error_correction',
      content: {
        mode: 'sentences',
        note: 'Indirekte tale.',
        items: [
          { id: 's-0', wrong: 'Anne sa at han har noen skrivefeil.' },
          { id: 's-1', wrong: 'Kari spør om har han fagbrev.' },
        ],
      },
    };
    renderWithProviders(<ExercisePreview exercise={exercise} />);

    expect(screen.getByText('Indirekte tale.')).toBeInTheDocument();
    expect(screen.getByText(/Anne sa at han har noen skrivefeil\./)).toBeInTheDocument();
    expect(screen.getByText(/Kari spør om har han fagbrev\./)).toBeInTheDocument();
  });

  it('lays a passage-mode error_correction out as paragraphs', () => {
    const exercise: ExerciseDisplay = {
      ...base,
      templateCode: 'error_correction',
      content: {
        mode: 'passage',
        items: [{ id: 'p-0', wrong: 'I går jeg gikk på jobb.' }],
      },
    };
    const { container } = renderWithProviders(<ExercisePreview exercise={exercise} />);

    // No numbering: a passage is one stretch of text, not a numbered set.
    expect(container.querySelector('ol')).toBeNull();
    expect(screen.getByText('I går jeg gikk på jobb.')).toBeInTheDocument();
  });

  // Plan 49 §8: the old branch read `content.left_items` / `right_items`, which
  // `/display` has not served since the projection landed. Both columns come from the
  // projection now, and the pool holds distractors the author never paired.
  it('renders match_pairs from the student projection, distractors included', () => {
    const exercise: ExerciseDisplay = {
      ...base,
      templateCode: 'match_pairs',
      content: {
        variant: 'halves',
        slots: [
          { slotId: 'p1', left: 'Kari tar imot Bartek' },
          { slotId: 'p2', left: 'Han vil bytte jobb fordi' },
        ],
        pool: [
          { itemId: 'r1', text: 'med et fast håndtrykk.' },
          { itemId: 'r2', text: 'han vil ta mer ansvar.' },
          { itemId: 'r3', text: 'på en byggeplass i Oslo.' },
        ],
        settings: { showRemaining: true },
      },
    };
    renderWithProviders(<ExercisePreview exercise={exercise} />);

    expect(screen.getByText('Kari tar imot Bartek')).toBeInTheDocument();
    expect(screen.getByText('Han vil bytte jobb fordi')).toBeInTheDocument();
    expect(screen.getByText('med et fast håndtrykk.')).toBeInTheDocument();
    expect(screen.getByText('på en byggeplass i Oslo.')).toBeInTheDocument();
  });
});

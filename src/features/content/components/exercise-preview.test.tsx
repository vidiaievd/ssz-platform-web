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
  it('renders a short_answer set: what it is, every question, and no key', () => {
    const exercise: ExerciseDisplay = {
      ...base,
      templateCode: 'short_answer',
      content: {
        title: 'Spørsmål til Tekst 1A',
        instruction: 'Svar med egne ord.',
        questions: [
          {
            id: 'q1',
            kind: 'reading',
            passage: 'Bartek har jobbet som elektriker i tre år.',
            prompt: 'Hvor lenge har Bartek jobbet der?',
          },
          {
            id: 'q2',
            kind: 'listening',
            passage: 'Programlederen sier …',
            prompt: 'Hva sier hun?',
          },
        ],
      },
    };
    renderWithProviders(<ExercisePreview exercise={exercise} />);

    expect(screen.getByText('Question set')).toBeInTheDocument();
    expect(screen.getByText('2 questions')).toBeInTheDocument();
    expect(screen.getByText('Spørsmål til Tekst 1A')).toBeInTheDocument();
    expect(screen.getByText('Hvor lenge har Bartek jobbet der?')).toBeInTheDocument();
    expect(screen.getByText(/Bartek har jobbet som elektriker/)).toBeInTheDocument();
    // A listening passage is the author's transcript, and the preview says so — the
    // student is never shown it.
    expect(screen.getByText('Transcript — the student does not see it')).toBeInTheDocument();
    expect(screen.getAllByText('Answer')).toHaveLength(2);
  });

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

  it('renders a writing_task task: mode, length, prompt and checklist', () => {
    const exercise: ExerciseDisplay = {
      ...base,
      templateCode: 'writing_task',
      content: {
        mode: 'letter',
        instruction: 'Skriv et brev.',
        prompt: 'Du vil klage på en vare du har kjøpt.',
        letter: { register: 'formal', recipient: 'Kundeservice' },
        points: [
          { id: 'p1', text: 'Fortell hva du kjøpte', required: true },
          { id: 'p2', text: 'Foreslå en løsning', required: false },
        ],
        phrases: ['Jeg skriver fordi'],
        settings: { minWords: 120, maxWords: 200 },
      },
    };
    renderWithProviders(<ExercisePreview exercise={exercise} />);

    expect(screen.getByText('Letter')).toBeInTheDocument();
    expect(screen.getByText('120–200 words')).toBeInTheDocument();
    expect(screen.getByText('Du vil klage på en vare du har kjøpt.')).toBeInTheDocument();
    expect(screen.getByText('Fortell hva du kjøpte')).toBeInTheDocument();
    expect(screen.getByText('optional')).toBeInTheDocument();
    expect(screen.getByText('Jeg skriver fordi')).toBeInTheDocument();
  });

  // A pre-plan-50 document coerces to an empty task rather than throwing: the old
  // `prompt`/`options` pair is not the shape `readContent` reads, and nothing renders
  // from it except the mode default.
  it('renders a pre-plan-50 writing_task without throwing', () => {
    const exercise: ExerciseDisplay = {
      ...base,
      templateCode: 'writing_task',
      content: { prompt: 'Skriv et kort leserinnlegg.', options: [{ id: 'a', title: 'Tog' }] },
    };
    renderWithProviders(<ExercisePreview exercise={exercise} />);

    expect(screen.getByText('Letter')).toBeInTheDocument();
    expect(screen.queryByText('Tog')).not.toBeInTheDocument();
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

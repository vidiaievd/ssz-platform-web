import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';

import { DEFAULT_EXERCISE_VALUES } from '../lib/exercise-content';
import type { ExerciseFormValues } from '../schemas/exercise';

import { ExerciseLessonPreview } from './exercise-lesson-preview';

const NOTE = enMessages.Authoring.exercises.fibRationaleAttached;

function renderPreview(values: Partial<ExerciseFormValues>) {
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <ExerciseLessonPreview
        title="Konjunksjoner"
        values={{ ...DEFAULT_EXERCISE_VALUES, ...values } as ExerciseFormValues}
      />
    </NextIntlClientProvider>,
  );
}

describe('ExerciseLessonPreview — fill_in_blank rationale note', () => {
  const fibBase = {
    templateCode: 'fill_in_blank' as const,
    fibText: 'Han sier ___1___ han er sliten.',
  };

  it('renders the sentence without a note when no rationale is authored', () => {
    renderPreview({
      ...fibBase,
      fibBlanks: [{ answers: 'at', rationaleExplanation: '', rationaleOptions: [] }],
    });
    expect(screen.getByText('Han sier ___1___ han er sliten.')).toBeInTheDocument();
    expect(screen.queryByText(NOTE)).toBeNull();
  });

  it('notes an attached matrix once options are authored', () => {
    renderPreview({
      ...fibBase,
      fibBlanks: [
        {
          answers: 'at',
          rationaleExplanation: '',
          rationaleOptions: [{ text: 'at', verdict: 'correct', note: 'Statement → at.' }],
        },
      ],
    });
    expect(screen.getByText(NOTE)).toBeInTheDocument();
  });

  it('notes an attached matrix when only the rule line is filled in', () => {
    renderPreview({
      ...fibBase,
      fibBlanks: [
        { answers: 'at', rationaleExplanation: 'A statement takes «at».', rationaleOptions: [] },
      ],
    });
    expect(screen.getByText(NOTE)).toBeInTheDocument();
  });

  it('ignores option rows that have no text yet', () => {
    renderPreview({
      ...fibBase,
      fibBlanks: [
        {
          answers: 'at',
          rationaleExplanation: '   ',
          rationaleOptions: [{ text: '  ', verdict: 'wrong', note: 'half-typed row' }],
        },
      ],
    });
    expect(screen.queryByText(NOTE)).toBeNull();
  });
});

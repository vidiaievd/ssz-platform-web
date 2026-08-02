import { fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { useForm } from 'react-hook-form';
import { describe, expect, it } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';

import { ExerciseFields } from './exercise-fields';
import { DEFAULT_EXERCISE_VALUES } from '../lib/exercise-content';
import type { ExerciseFormValues } from '../schemas/exercise';

/** The seeded indirect-speech task from Norsk B1, leksjon 1. */
const KEY = {
  saQuestion: '«Jeg skal begynne 1. april», sa Bartek.',
  saReferenceAnswer: 'Bartek sa at han skulle begynne 1. april.',
  saAccepted: 'at han skulle begynne 1. april',
};

function Harness() {
  const { control, register, formState } = useForm<ExerciseFormValues>({
    defaultValues: { ...DEFAULT_EXERCISE_VALUES, templateCode: 'short_answer', ...KEY },
  });
  return (
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <ExerciseFields
        control={control}
        register={register}
        errors={formState.errors}
        isPending={false}
      />
    </NextIntlClientProvider>
  );
}

const trialInput = () => screen.getByLabelText('Try the answer key');
const acceptedInput = () =>
  screen.getByLabelText('Other accepted phrasings (optional)') as HTMLInputElement;

describe('ShortAnswerFields — answer key trial', () => {
  it('says nothing until the author tries an answer', () => {
    render(<Harness />);
    expect(screen.queryByText(/Accepted automatically/)).not.toBeInTheDocument();
  });

  it('reports an answer the key accepts outright', () => {
    render(<Harness />);
    fireEvent.change(trialInput(), { target: { value: 'at han skulle begynne 1. april' } });
    expect(screen.getByText('✓ Accepted automatically.')).toBeInTheDocument();
  });

  it('shows the author the same word-by-word markup the learner would get', () => {
    render(<Harness />);
    fireEvent.change(trialInput(), { target: { value: 'han skulle begynte 1. april' } });
    expect(screen.getByText(/Marked wrong/)).toBeInTheDocument();
    expect(screen.getByTitle('Missing word')).toHaveTextContent('at');
    expect(screen.getByTitle('Wrong form of the word')).toHaveTextContent('begynte');
  });

  it('warns when a phrasing would land on the teacher, and can accept it in one click', () => {
    render(<Harness />);
    fireEvent.change(trialInput(), {
      target: { value: 'Bartek fortalte at han begynte i jobben til våren' },
    });
    expect(screen.getByText(/goes to you for manual grading/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Add this phrasing as accepted' }));

    expect(acceptedInput().value).toBe(
      'at han skulle begynne 1. april | Bartek fortalte at han begynte i jobben til våren',
    );
    // And the verdict flips now that the key covers it.
    expect(screen.getByText('✓ Accepted automatically.')).toBeInTheDocument();
  });

  it('leaves the exercise fields themselves untouched by a trial', () => {
    render(<Harness />);
    const before = acceptedInput().value;
    fireEvent.change(trialInput(), { target: { value: 'noe helt annet' } });
    expect(acceptedInput().value).toBe(before);
  });
});

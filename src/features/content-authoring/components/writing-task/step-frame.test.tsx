import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import { emptyContent, LEN_DEFAULTS, type WritingTask } from '@/lib/shared-kernel/writing-task';

import { StepFrame } from './step-frame';

function doc(overrides: Partial<WritingTask> = {}): WritingTask {
  const content = emptyContent();
  return {
    id: 'ex-1',
    type: 'writing_task',
    moduleId: 'module-1',
    title: '',
    updatedAt: '2026-08-22T10:00:00.000Z',
    ...content,
    prompt: 'Du har nettopp flyttet til en ny by.',
    ...overrides,
  };
}

function Harness({
  initial,
  onChange,
}: {
  initial: WritingTask;
  onChange?: (next: WritingTask) => void;
}) {
  const [exercise, setExercise] = useState(initial);
  return (
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <StepFrame
        exercise={exercise}
        onChange={(next) => {
          onChange?.(next);
          setExercise(next);
        }}
      />
    </NextIntlClientProvider>
  );
}

function renderStep(initial: WritingTask = doc(), onChange?: (next: WritingTask) => void) {
  render(<Harness initial={initial} onChange={onChange} />);
  return { user: userEvent.setup() };
}

describe('the word range', () => {
  it('says what the two numbers actually do', () => {
    renderStep();

    expect(screen.getByText('Submit is locked below 120 words and above 200.')).toBeInTheDocument();
  });

  it('says that a maximum of zero is no ceiling, not a ceiling of nothing', () => {
    renderStep(doc({ settings: { ...doc().settings, maxWords: 0 } }));

    expect(screen.getByText(/No ceiling/)).toBeInTheDocument();
  });

  it('marks both fields invalid when the maximum is under the minimum', () => {
    renderStep(doc({ settings: { ...doc().settings, minWords: 200, maxWords: 150 } }));

    expect(screen.getByLabelText('At least')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('At most')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText(/or nothing can be handed in/)).toBeInTheDocument();
  });

  it('refuses a negative word count rather than storing one', async () => {
    const onChange = vi.fn();
    const { user } = renderStep(doc(), onChange);

    const min = screen.getByLabelText('At least');
    await user.clear(min);
    await user.type(min, '-5');

    const next = onChange.mock.calls.at(-1)![0] as WritingTask;
    expect(next.settings.minWords).toBe(5);
  });

  it('offers the mode default back once the range has drifted from it', async () => {
    const { user } = renderStep(doc({ settings: { ...doc().settings, minWords: 60 } }));

    expect(screen.getByText(/A Letter usually runs 120–200 words/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Use that range/ }));

    expect(screen.getByLabelText('At least')).toHaveValue(LEN_DEFAULTS.letter[0]);
    expect(screen.queryByRole('button', { name: /Use that range/ })).not.toBeInTheDocument();
  });
});

describe('the timer', () => {
  it('is off by default and says nothing about it', () => {
    renderStep();

    expect(screen.getByRole('radio', { name: 'Off' })).toBeChecked();
    expect(screen.queryByText(/is not enough time/)).not.toBeInTheDocument();
  });

  it('warns when the clock does not fit the length asked for', () => {
    renderStep(doc({ settings: { ...doc().settings, timer: 5, minWords: 200 } }));

    expect(
      screen.getByText('5 minutes for at least 200 words is not enough time to write and reread.'),
    ).toBeInTheDocument();
  });
});

describe('what the student is given', () => {
  it('will not offer phrases that do not exist, and says where to write them', () => {
    renderStep();

    const phrases = screen.getByRole('switch', { name: /Offer the useful phrases/ });
    expect(phrases).toBeDisabled();
    expect(screen.getByText(/add some in step 1/)).toBeInTheDocument();
  });

  it('offers them once step 1 has some', () => {
    renderStep(doc({ phrases: ['Jeg synes at…'] }));

    expect(screen.getByRole('switch', { name: /Offer the useful phrases/ })).toBeEnabled();
  });

  it('turns the checklist off', async () => {
    const onChange = vi.fn();
    const { user } = renderStep(doc(), onChange);

    await user.click(screen.getByRole('switch', { name: /Show the points as a checklist/ }));

    expect((onChange.mock.calls.at(-1)![0] as WritingTask).settings.showPlan).toBe(false);
  });
});

describe('the paste warning', () => {
  it('says plainly what blocking paste does not do', () => {
    renderStep();

    expect(screen.getByText(/It is a threshold, not a defence/)).toBeInTheDocument();
  });

  it('goes away with the setting it is about', async () => {
    const { user } = renderStep();

    await user.click(screen.getByRole('switch', { name: /Block pasting/ }));

    expect(screen.queryByText(/It is a threshold, not a defence/)).not.toBeInTheDocument();
  });
});

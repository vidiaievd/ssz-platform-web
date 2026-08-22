import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import { emptyContent, LEN_DEFAULTS, type WritingTask } from '@/lib/shared-kernel/writing-task';

import { StepTask } from './step-task';

vi.mock('@/features/media', () => ({
  ACCEPTED_IMAGE_TYPES: ['image/png'],
  MAX_FILE_SIZE_BYTES: 5_000_000,
  uploadAsset: vi.fn(),
  useMediaAsset: () => ({ data: undefined, isLoading: false }),
}));

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
    points: content.points.map((point) => ({ ...point, text: 'Fortell hvor du bor nå' })),
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
      <StepTask
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

describe('the mode picker', () => {
  it('swaps the material block without touching what the author wrote', async () => {
    const { user } = renderStep(
      doc({
        source: 'En kort artikkel om Bergen.',
        letter: { register: 'formal', recipient: 'Naboen' },
      }),
    );

    expect(screen.getByLabelText('Who the letter is to')).toHaveValue('Naboen');

    await user.click(screen.getByRole('radio', { name: /Retelling/ }));

    expect(screen.queryByLabelText('Who the letter is to')).not.toBeInTheDocument();
    expect(screen.getByLabelText('The text being retold')).toHaveValue(
      'En kort artikkel om Bergen.',
    );
    expect(screen.getByLabelText('The task itself')).toHaveValue(
      'Du har nettopp flyttet til en ny by.',
    );
  });

  it('resets the word range to the new mode default', async () => {
    const onChange = vi.fn();
    const { user } = renderStep(doc(), onChange);

    await user.click(screen.getByRole('radio', { name: /Essay/ }));

    const next = onChange.mock.calls.at(-1)![0] as WritingTask;
    expect([next.settings.minWords, next.settings.maxWords]).toEqual([...LEN_DEFAULTS.essay]);
  });

  it('says nothing when the range it replaced was nobody\'s choice', async () => {
    // Straight off the letter default: the numbers changed, but no decision was undone,
    // and a line about it would be noise on the ordinary first pick of the right type.
    const { user } = renderStep();

    await user.click(screen.getByRole('radio', { name: /Essay/ }));

    expect(screen.queryByText(/Length set to/)).not.toBeInTheDocument();
  });

  it('reports replacing a range the author set, and offers the old one back', async () => {
    const onChange = vi.fn();
    const chosen = doc({ settings: { ...doc().settings, minWords: 90, maxWords: 150 } });
    const { user } = renderStep(chosen, onChange);

    await user.click(screen.getByRole('radio', { name: /Essay/ }));
    expect(screen.getByText('Length set to 200–350 words for Essay.')).toBeInTheDocument();

    // The range itself is edited on step 2; this only puts the author's numbers back.
    await user.click(screen.getByRole('button', { name: 'Keep 90–150' }));

    const next = onChange.mock.calls.at(-1)![0] as WritingTask;
    expect([next.settings.minWords, next.settings.maxWords]).toEqual([90, 150]);
    expect(next.mode).toBe('essay');
    expect(screen.queryByText(/Length set to/)).not.toBeInTheDocument();
  });
});

describe('the blockers the rail marks', () => {
  it('says on the step why it is marked, not only in the gate', async () => {
    // A red dot on step 1 and nothing red on step 1 is a marker pointing at itself.
    const { user } = renderStep(doc({ points: [{ id: 'p1', text: '', keywords: [], required: true }] }));

    expect(screen.getByText('Add at least one thing the text must cover.')).toBeInTheDocument();
    expect(screen.getByLabelText('Point 1')).toHaveAttribute('aria-invalid', 'true');

    await user.type(screen.getByLabelText('Point 1'), 'Fortell hvor du bor');

    expect(
      screen.queryByText('Add at least one thing the text must cover.'),
    ).not.toBeInTheDocument();
  });

  it('explains a missing source text where the field is', async () => {
    const { user } = renderStep(doc({ source: '' }));

    await user.click(screen.getByRole('radio', { name: /Retelling/ }));

    expect(screen.getByText('A retelling needs the text being retold.')).toBeInTheDocument();
  });

  it('explains a missing picture under the slot', async () => {
    const { user } = renderStep();

    await user.click(screen.getByRole('radio', { name: /Picture/ }));

    expect(screen.getByText('A picture description needs a picture.')).toBeInTheDocument();
  });
});

describe('the prompt', () => {
  it('says it is required, and marks itself invalid, while it is empty', () => {
    renderStep(doc({ prompt: '' }));

    const prompt = screen.getByLabelText('The task itself');
    expect(prompt).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText(/Without it there is no task/)).toBeInTheDocument();
  });

  it('stops saying so once it is written', () => {
    renderStep();

    expect(screen.getByLabelText('The task itself')).toHaveAttribute('aria-invalid', 'false');
    expect(screen.getByText(/The situation, not the checklist/)).toBeInTheDocument();
  });
});

describe('must-cover points', () => {
  it('refuses to delete the only point there is', () => {
    renderStep();

    expect(screen.getByRole('button', { name: 'Remove point 1' })).toBeDisabled();
  });

  it('adds a point, then lets both be deleted', async () => {
    const { user } = renderStep();

    await user.click(screen.getByRole('button', { name: 'Add a point' }));

    expect(screen.getByRole('button', { name: 'Remove point 1' })).toBeEnabled();
    expect(screen.getByLabelText('Point 2')).toHaveValue('');
  });

  it('stops offering more past six', async () => {
    const { user } = renderStep();
    const add = screen.getByRole('button', { name: 'Add a point' });

    for (let i = 0; i < 5; i += 1) await user.click(add);

    expect(screen.getByLabelText('Point 6')).toBeInTheDocument();
    expect(add).toBeDisabled();
  });

  it('commits a keyword on blur, not only on Enter', async () => {
    const { user } = renderStep();

    await user.type(screen.getByLabelText('Keywords for point 1'), 'flyttet til');
    await user.click(screen.getByLabelText('The task itself'));

    expect(
      screen.getByRole('button', { name: 'Remove keyword “flyttet til”' }),
    ).toBeInTheDocument();
  });

  it('commits a keyword on Enter and clears the field for the next one', async () => {
    const { user } = renderStep();

    const field = screen.getByLabelText('Keywords for point 1');
    await user.type(field, 'flyttet til{Enter}');

    expect(field).toHaveValue('');
    await user.click(screen.getByRole('button', { name: 'Remove keyword “flyttet til”' }));
    expect(
      screen.queryByRole('button', { name: 'Remove keyword “flyttet til”' }),
    ).not.toBeInTheDocument();
  });

  it('says plainly that keywords cannot reject an answer', () => {
    renderStep();

    expect(screen.getByText(/Nothing here can reject a student's answer/)).toBeInTheDocument();
  });
});

describe('the example answer', () => {
  it('offers no readout until something is written', () => {
    renderStep();

    expect(screen.getByText(/A free text has no key to test the task against/)).toBeInTheDocument();
  });

  it('counts words and paragraphs, and how many points its own text covers', async () => {
    const withKeywords = doc();
    withKeywords.points = withKeywords.points.map((point) => ({
      ...point,
      keywords: ['flyttet til Bergen'],
    }));
    const { user } = renderStep(withKeywords);

    await user.type(screen.getByLabelText('Example answer'), 'Hei! Jeg har flyttet til Bergen.');

    expect(screen.getByRole('status')).toHaveTextContent(
      '6 words, 1 paragraphs, 1/1 points covered',
    );
  });

  it('warns rather than reassures when its own text misses a point', async () => {
    // The keyword does not match how anybody would phrase it, which is exactly what this
    // readout exists to catch — the model answer is fine, the keyword is not.
    const withKeywords = doc();
    withKeywords.points = withKeywords.points.map((point) => ({
      ...point,
      keywords: ['bosatt i kommunen'],
    }));
    const { user } = renderStep(withKeywords);

    await user.type(screen.getByLabelText('Example answer'), 'Hei! Jeg har flyttet til Bergen.');

    const readout = screen.getByRole('status');
    expect(readout).toHaveTextContent('0/1 points covered');
    expect(readout).toHaveClass('text-warning-700');
  });
});

describe('useful phrases', () => {
  it('adds and removes a phrase', async () => {
    const { user } = renderStep();

    await user.type(screen.getByLabelText('Useful phrases'), 'Jeg synes at…{Enter}');

    const chip = screen.getByRole('button', { name: 'Remove phrase “Jeg synes at…”' });
    await user.click(chip);
    expect(
      screen.queryByRole('button', { name: 'Remove phrase “Jeg synes at…”' }),
    ).not.toBeInTheDocument();
  });
});

describe('the picture mode', () => {
  it('asks for a caption and an alt text of its own', async () => {
    const { user } = renderStep();

    await user.click(screen.getByRole('radio', { name: /Picture/ }));

    expect(screen.getByLabelText('Caption')).toBeInTheDocument();
    expect(screen.getByLabelText('Alt text')).toBeInTheDocument();
    expect(screen.getByText(/A still life gives them a list of nouns/)).toBeInTheDocument();
  });
});

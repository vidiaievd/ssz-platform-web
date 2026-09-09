import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import type { Container } from '@/features/content/types';

vi.mock('../actions/exercise', () => ({
  updateExerciseAction: vi.fn(),
}));
// The pane now reaches the gap-fill builder, which imports its autosave server action.
// Server modules are stripped from the client bundle for real; here they would run.
vi.mock('../actions/gap-fill', () => ({ saveGapFillAction: vi.fn() }));
vi.mock('../actions/error-correction', () => ({ saveErrorCorrectionAction: vi.fn() }));
vi.mock('../actions/translate', () => ({ saveTranslateAction: vi.fn() }));
vi.mock('../actions/match-pairs', () => ({ saveMatchPairsAction: vi.fn() }));
vi.mock('../actions/writing-task', () => ({ saveWritingTaskAction: vi.fn() }));
vi.mock('../actions/short-answer', () => ({ saveShortAnswerAction: vi.fn() }));
vi.mock('../actions/sentence-schema', () => ({ saveSentenceSchemaAction: vi.fn() }));
vi.mock('../actions/multiple-choice', () => ({ saveMultipleChoiceAction: vi.fn() }));
vi.mock('../actions/multiple-choice-group', () => ({ saveMultipleChoiceGroupAction: vi.fn() }));
vi.mock('../api/use-authoring-exercises', () => ({
  useAuthoringExercise: vi.fn(),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/lib/i18n/navigation', () => ({
  Link: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
  } & React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const { ExerciseEditorPane } = await import('./exercise-editor-pane');
const { updateExerciseAction } = await import('../actions/exercise');
const { useAuthoringExercise } = await import('../api/use-authoring-exercises');
const { toast } = await import('sonner');

const CONTAINER: Container = {
  id: 'module-1',
  slug: 'module-1',
  title: 'Samfunn og kultur',
  containerType: 'module',
  targetLanguage: 'no',
  difficultyLevel: 'A2',
  visibility: 'public',
  accessTier: 'free_within_school',
  ownerUserId: 'user-1',
  createdAt: '',
  updatedAt: '',
};

function renderPane(isLive: boolean | null = false) {
  const queryClient = new QueryClient();
  render(
    <QueryClientProvider client={queryClient}>
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <ExerciseEditorPane
          kind="exercise"
          exerciseId="exercise-1"
          lessonTitle="Blandet øving"
          state="draft"
          isLive={isLive}
          container={CONTAINER}
          publishSlot={null}
        />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.mocked(toast.success).mockReset();
  vi.mocked(updateExerciseAction).mockReset();
  vi.mocked(updateExerciseAction).mockResolvedValue({ ok: true, value: undefined } as never);
  vi.mocked(useAuthoringExercise).mockReturnValue({
    data: {
      id: 'exercise-1',
      exerciseTemplateId: 'tpl-mcq',
      templateCode: 'multiple_choice',
      targetLanguage: 'no',
      difficultyLevel: 'A2',
      content: {
        question: 'Hva heter du?',
        options: [
          { id: 'opt-0', text: 'Ja' },
          { id: 'opt-1', text: 'Nei' },
          { id: 'opt-2', text: 'Kanskje' },
        ],
      },
      expectedAnswers: { correct_option_ids: ['opt-0'] },
      instructions: [{ instructionLanguage: 'en', instructionText: 'Choose the correct answer.' }],
    },
    isLoading: false,
  } as never);
});

describe('ExerciseEditorPane', () => {
  it('renders the loaded multiple-choice content in both the editor and the live preview', () => {
    renderPane();
    expect(screen.getByDisplayValue('Hva heter du?')).toBeInTheDocument();
    expect(screen.getAllByDisplayValue('Ja')).toHaveLength(1);
    expect(screen.getByText('Ja')).toBeInTheDocument();
  });

  it('saves edits via updateExerciseAction on submit', async () => {
    renderPane();

    fireEvent.change(screen.getByDisplayValue('Hva heter du?'), {
      target: { value: 'Hvor bor du?' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(updateExerciseAction).toHaveBeenCalledWith(
        'exercise-1',
        'module-1',
        expect.objectContaining({ templateCode: 'multiple_choice', mcQuestion: 'Hvor bor du?' }),
      );
    });
  });

  it('refuses to save an exercise whose instruction was cleared', async () => {
    // An exercise with no instruction row is a publish blocker
    // (`EXERCISE_INCOMPLETE`), discovered only on the review screen — so the
    // editor refuses the save instead.
    renderPane();

    fireEvent.change(screen.getByDisplayValue('Choose the correct answer.'), {
      target: { value: '' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(screen.getByText('Required')).toBeInTheDocument());
    expect(updateExerciseAction).not.toHaveBeenCalled();
  });

  it('updates the live preview as the author edits the question', async () => {
    renderPane();

    fireEvent.change(screen.getByDisplayValue('Hva heter du?'), {
      target: { value: 'Hvor bor du?' },
    });

    await waitFor(() => {
      expect(screen.getByText('Hvor bor du?')).toBeInTheDocument();
    });
  });
  it('promises a publish before students see the edit, even on live material', () => {
    // The exercise document waits in its draft whatever the placement says, so the
    // old "students see every save immediately" would now be a false promise.
    renderPane(true);
    expect(screen.getByText('Saves are held until you publish the module.')).toBeInTheDocument();
  });

  it('says the same for material students cannot open yet', () => {
    renderPane(false);
    expect(screen.getByText('Saves are held until you publish the module.')).toBeInTheDocument();
  });

  it('opens the error-correction builder on its own document, answer key and all', () => {
    // The two columns are stored apart — `wrong` is what a student may see, `ref` is the
    // answer — and the builder is the one place they are a single document again.
    vi.mocked(useAuthoringExercise).mockReturnValue({
      data: {
        id: 'exercise-1',
        exerciseTemplateId: 'tpl-ec',
        templateCode: 'error_correction',
        targetLanguage: 'no',
        difficultyLevel: 'B1',
        content: { mode: 'sentences', items: [{ id: 'i1', wrong: 'I går jeg gikk på kino.' }] },
        expectedAnswers: { items: { i1: { ref: 'I går gikk jeg på kino.' } } },
        instructions: [{ instructionLanguage: 'en', instructionText: 'Finn feilen.' }],
        updatedAt: '2026-08-12T10:00:00.000Z',
      },
      isLoading: false,
    } as never);

    renderPane();

    expect(screen.getByRole('tab', { name: /Format/ })).toBeInTheDocument();
    expect(screen.getByDisplayValue('Finn feilen.')).toBeInTheDocument();
    // The preview column runs the document through the student projection, so the faulty
    // sentence is there word by word and the answer key is not.
    expect(screen.getAllByText('kino.').length).toBeGreaterThan(0);
    expect(screen.queryByText('gikk jeg')).not.toBeInTheDocument();
  });

  it('opens the writing-task builder, and its preview keeps the answer key back', () => {
    // The stored shape is the one plan 50 phase 2 rewrote: the checklist point's text is
    // in `content`, the phrasings that would satisfy it and the model answer are not.
    vi.mocked(useAuthoringExercise).mockReturnValue({
      data: {
        id: 'exercise-1',
        exerciseTemplateId: 'tpl-wt',
        templateCode: 'writing_task',
        targetLanguage: 'no',
        difficultyLevel: 'B1',
        content: {
          mode: 'letter',
          instruction: 'Skriv et brev.',
          prompt: 'Du har nettopp flyttet til en ny by.',
          letter: { register: 'informal', recipient: 'En venn' },
          points: [{ id: 'p1', text: 'Fortell hvor du bor nå', required: true }],
          rubric: [{ id: 'c1', name: 'Oppgaveløsning', weight: 2, metric: 'points' }],
          settings: { minWords: 120, maxWords: 200, passScore: 4 },
        },
        expectedAnswers: {
          points: { p1: { keywords: ['flyttet til Bergen'] } },
          rubric: { c1: { levels: ['a', 'b', 'c', 'Alle punktene er dekket'] } },
          model: 'Hei Anna! Jeg har flyttet til Bergen.',
        },
        instructions: [{ instructionLanguage: 'en', instructionText: 'Skriv et brev.' }],
        updatedAt: '2026-08-22T10:00:00.000Z',
      },
      isLoading: false,
    } as never);

    renderPane();

    expect(screen.getByRole('tab', { name: /The task/ })).toBeInTheDocument();
    expect(screen.getByLabelText('The task itself')).toHaveValue(
      'Du har nettopp flyttet til en ny by.',
    );

    // The answer key belongs on the author's screen and nowhere else. Scoped to the
    // preview column, because the keywords and the model answer are step-1 fields — it
    // is the student's side that must not carry them.
    const preview = within(screen.getByLabelText('Student preview, phone'));
    expect(preview.getByText('Du har nettopp flyttet til en ny by.')).toBeInTheDocument();
    expect(preview.getByText('Fortell hvor du bor nå')).toBeInTheDocument();
    expect(preview.queryByText(/flyttet til Bergen/)).not.toBeInTheDocument();
    expect(preview.queryByText(/Alle punktene er dekket/)).not.toBeInTheDocument();
    expect(preview.queryByText(/Hei Anna/)).not.toBeInTheDocument();
  });

  it('opens the short-answer builder on a document of the new form, key held back', () => {
    // The dispatch is on the shape of the document, not on the template code — plan 51
    // §8 Q1. `questions` is what says this one is of the new form.
    vi.mocked(useAuthoringExercise).mockReturnValue({
      data: {
        id: 'exercise-1',
        exerciseTemplateId: 'tpl-sa',
        templateCode: 'short_answer',
        targetLanguage: 'no',
        difficultyLevel: 'B1',
        content: {
          title: '',
          instruction: 'Svar med én til tre setninger.',
          questions: [
            {
              id: 'q1',
              kind: 'reading',
              passage: 'Fra 1. januar må alle syklister ha lys foran og bak.',
              prompt: 'Hva er nytt fra 1. januar?',
            },
          ],
          settings: {
            passRule: 'all',
            minWords: 3,
            showModel: 'onClose',
            teacherReview: 'flagged',
          },
        },
        expectedAnswers: {
          questions: {
            q1: {
              elements: [{ id: 'e1', label: 'kravet', anchors: ['lys foran'], required: true }],
              model: 'Alle syklister må ha lys foran og bak.',
              why: 'Teksten sier hva regelen krever.',
            },
          },
        },
        instructions: [
          { instructionLanguage: 'en', instructionText: 'Svar med én til tre setninger.' },
        ],
        updatedAt: '2026-08-23T10:00:00.000Z',
      },
      isLoading: false,
    } as never);

    renderPane();

    expect(screen.getByRole('tab', { name: /Answer key/ })).toBeInTheDocument();

    // The anchor phrases and the model answer are the answer written in the words the
    // student is being asked to find; the projection keeps both off their screen.
    const preview = within(screen.getByLabelText('Student preview, phone'));
    expect(preview.getByText('Hva er nytt fra 1. januar?')).toBeInTheDocument();
    expect(preview.queryByText(/Alle syklister må ha lys/)).not.toBeInTheDocument();
    expect(preview.queryByText(/Teksten sier hva regelen krever/)).not.toBeInTheDocument();
    expect(preview.queryByText('kravet')).not.toBeInTheDocument();
  });

  it('opens the multiple-choice builder on a set, key held back', () => {
    // Dispatch on the template code *and* the shape of the document — plan 53 §3.9. 121
    // of this type's 131 seeded exercises are still single questions; `questions` is what
    // says this one is a set.
    vi.mocked(useAuthoringExercise).mockReturnValue({
      data: {
        id: 'exercise-1',
        exerciseTemplateId: 'tpl-mc',
        templateCode: 'multiple_choice',
        targetLanguage: 'no',
        difficultyLevel: 'B1',
        content: {
          title: 'Indirekte tale',
          instruction: 'Velg det riktige svaret.',
          questions: [
            {
              id: 'q1',
              kind: 'grammar',
              context: '',
              stem: 'Han sa at han ___ syk.',
              options: [
                { id: 'a', text: 'er', fixed: false },
                { id: 'b', text: 'var', fixed: false },
              ],
            },
          ],
          settings: { letters: true, layout: 'list', shuffle: false, retry: 'one' },
        },
        expectedAnswers: {
          questions: {
            q1: {
              correctOptionId: 'b',
              why: 'Presens blir preteritum etter «sa».',
              options: { a: 'Presens holder ikke her.' },
            },
          },
        },
        instructions: [{ instructionLanguage: 'en', instructionText: 'Velg det riktige svaret.' }],
        updatedAt: '2026-08-28T10:00:00.000Z',
      },
      isLoading: false,
    } as never);

    renderPane();

    expect(screen.getByRole('tab', { name: /Distractors/ })).toBeInTheDocument();

    // The rule and the rebuttals are the answer: the projection keeps all three off the
    // student's screen until a pick closes the question.
    const preview = within(screen.getByLabelText('Student preview, phone'));
    expect(preview.getByText('Han sa at han ___ syk.')).toBeInTheDocument();
    expect(preview.queryByText(/Presens blir preteritum/)).not.toBeInTheDocument();
    expect(preview.queryByText(/Presens holder ikke her/)).not.toBeInTheDocument();
  });

  it('opens the statement-table builder on a table, key held back', () => {
    // Dispatch on the template code *and* the shape of the document — plan 54 §1.2. The
    // two documents of the old form keep `items`; `rows` is what says this one is a table.
    vi.mocked(useAuthoringExercise).mockReturnValue({
      data: {
        id: 'exercise-1',
        exerciseTemplateId: 'tpl-mcg',
        templateCode: 'multiple_choice_group',
        targetLanguage: 'no',
        difficultyLevel: 'B1',
        content: {
          title: 'Riktig eller galt',
          instruction: 'Les teksten.',
          source: { mode: 'inline', label: 'Tekst 1A', text: 'Bartek søker ny jobb.' },
          columns: [
            { id: 'c1', label: 'Riktig', short: 'R' },
            { id: 'c2', label: 'Galt', short: 'G' },
          ],
          rows: [
            { id: 'r1', text: 'Bartek leter etter arbeid.' },
            { id: 'r2', text: 'Bartek har sluttet å søke.' },
          ],
          settings: {
            numbering: true,
            shuffleRows: false,
            layout: 'auto',
            showText: true,
            retry: 'one',
            lockCorrect: true,
            showWhy: 'wrong',
            revealKey: true,
            passThreshold: 70,
            progress: true,
          },
        },
        expectedAnswers: {
          rows: {
            r1: { answer: 'c1', why: 'Teksten sier at han søker.', quote: 'søker ny jobb' },
            r2: { answer: 'c2', why: 'Det motsatte står i teksten.', quote: '' },
          },
        },
        instructions: [{ instructionLanguage: 'en', instructionText: 'Les teksten.' }],
        updatedAt: '2026-08-29T10:00:00.000Z',
      },
      isLoading: false,
    } as never);

    renderPane();

    expect(screen.getByRole('tab', { name: /Statements/ })).toBeInTheDocument();

    // Which column each statement belongs in, the author's line and the quote that proves
    // it are the answer: the projection keeps all three off the student's screen.
    const preview = within(screen.getByLabelText('Student preview, phone'));
    expect(preview.getByText('Bartek leter etter arbeid.')).toBeInTheDocument();
    expect(preview.queryByText(/Teksten sier at han søker/)).not.toBeInTheDocument();
    expect(preview.queryByText(/Det motsatte står i teksten/)).not.toBeInTheDocument();
  });

  it('leaves a multiple-choice document of the old form to the generic form', () => {
    // The default fixture of this suite is one of the 121. Asserted explicitly so the
    // dispatch cannot start claiming them by template code alone.
    renderPane();

    expect(screen.queryByRole('tab', { name: /Distractors/ })).not.toBeInTheDocument();
    expect(screen.getByDisplayValue('Hva heter du?')).toBeInTheDocument();
  });

  it('leaves a short-answer document of the old form to the generic form', () => {
    // 144 of these are still live, and the builder cannot edit one: there are no
    // questions, no elements and no model answer to open it on.
    vi.mocked(useAuthoringExercise).mockReturnValue({
      data: {
        id: 'exercise-1',
        exerciseTemplateId: 'tpl-sa',
        templateCode: 'short_answer',
        targetLanguage: 'no',
        difficultyLevel: 'B1',
        content: { question: 'Hvorfor trenger de egenkapital?', context: 'Tekst 3A.' },
        expectedAnswers: {
          reference_answer: 'Fordi banken krever det.',
          accepted_answers: ['Fordi banken krever det.'],
        },
        instructions: [{ instructionLanguage: 'en', instructionText: 'Svar kort.' }],
        updatedAt: '2026-08-23T10:00:00.000Z',
      },
      isLoading: false,
    } as never);

    renderPane();

    expect(screen.queryByRole('tab', { name: /Answer key/ })).not.toBeInTheDocument();
    expect(screen.getByDisplayValue('Hvorfor trenger de egenkapital?')).toBeInTheDocument();
  });

  it('confirms a save as pending a publish, on live material too', async () => {
    renderPane(true);

    fireEvent.change(screen.getByDisplayValue('Hva heter du?'), {
      target: { value: 'Hvor bor du?' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith('Exercise saved.', {
        description: 'Saved. Students keep seeing the published version until you publish.',
      }),
    );
  });
});

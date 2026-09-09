import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import { readAudioDraft, type AudioDraft } from '@/lib/shared-kernel/audio';
import { emptyContent, type WritingTask } from '@/lib/shared-kernel/writing-task';

// The source card resolves the clip through media-service, and this builder's tests
// mount no QueryClientProvider (plan 56 phase 6).
vi.mock('@/features/media', () => ({
  useMediaAsset: () => ({ data: undefined }),
  uploadAsset: vi.fn(),
}));

vi.mock('../../actions/writing-task', () => ({ saveWritingTaskAction: vi.fn() }));

// Step 4 links into the marking queue, which needs the school route around it.
vi.mock('next/navigation', () => ({ useParams: () => ({ schoolSlug: 'demo-school' }) }));
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

const { WritingTaskBuilder } = await import('./builder');
const { saveWritingTaskAction } = await import('../../actions/writing-task');

const LOADED_AT = '2026-08-22T10:00:00.000Z';

/** A document with nothing left to fix, so a test can add exactly one problem. */
function doc(overrides: Partial<WritingTask> = {}): WritingTask {
  const content = emptyContent();
  return {
    id: 'ex-1',
    type: 'writing_task',
    moduleId: 'module-1',
    title: '',
    updatedAt: LOADED_AT,
    ...content,
    prompt: 'Du har nettopp flyttet til en ny by. Skriv et brev til en venn.',
    model: 'Hei Anna! Jeg har flyttet til Bergen.',
    letter: { register: 'informal', recipient: 'En venn' },
    points: content.points.map((point) => ({
      ...point,
      text: 'Fortell hvor du bor nå',
      keywords: ['flyttet til'],
    })),
    ...overrides,
  };
}

function renderBuilder(
  exercise: WritingTask = doc(),
  // Every builder carries the audio layer, and an exercise that has never had any reads
  // as switched off (plan 56 phase 6).
  audio: AudioDraft = readAudioDraft({}, 'writing_task'),
) {
  render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <WritingTaskBuilder
        exerciseId="ex-1"
        containerId="module-1"
        initialExercise={exercise}
        initialAudio={audio}
      />
    </NextIntlClientProvider>,
  );
  return { user: userEvent.setup() };
}

beforeEach(() => {
  vi.mocked(saveWritingTaskAction).mockResolvedValue({
    ok: true,
    value: { status: 'saved', updatedAt: '2026-08-22T10:00:05.000Z' },
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

/**
 * The gate, from where an author reaches it: the last step's own way forward.
 *
 * There is no longer a `Review & finish` in the top bar — it read as a second
 * `Review & publish` — so a test that wants the gate walks to step 4 the way a person
 * does.
 */
async function openGate(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('tab', { name: /Flow/ }));
  await user.click(screen.getByRole('button', { name: /Review & finish/ }));
}

describe('WritingTaskBuilder', () => {
  it('opens on a clean rail when the document has nothing left to fix', () => {
    renderBuilder();

    expect(screen.getByRole('tab', { name: /The task/ })).toHaveAttribute('aria-selected', 'true');
    for (const step of ['The task', 'The frame', 'Marking', 'Flow']) {
      expect(
        within(screen.getByRole('tab', { name: new RegExp(step) })).getByText('ready'),
      ).toBeInTheDocument();
    }
  });

  it('marks the step that holds a blocker, and reaches it in one click', async () => {
    // A pass mark above what the rubric can award: step 3, and nobody could pass.
    const { user } = renderBuilder(doc({ settings: { ...doc().settings, passScore: 99 } }));

    const marking = screen.getByRole('tab', { name: /Marking/ });
    expect(within(marking).getByText('1 problem')).toBeInTheDocument();

    await user.click(marking);
    expect(marking).toHaveAttribute('aria-selected', 'true');
  });

  it('counts the blockers on the steps that hold them, wherever the author is', () => {
    // The total used to sit on a button in the top bar. The rail says the same thing and
    // says it better — a count of two is a number, and two marked steps is a direction.
    renderBuilder(doc({ prompt: '', settings: { ...doc().settings, passScore: 99 } }));

    expect(
      within(screen.getByRole('tab', { name: /The task/ })).getByText('1 problem'),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole('tab', { name: /Marking/ })).getByText('1 problem'),
    ).toBeInTheDocument();
  });

  it('blocks the gate while a blocker stands, and links to the step that owns it', async () => {
    const { user } = renderBuilder(doc({ prompt: '' }));

    await openGate(user);

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText(/Write the task itself/)).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: /Fix 1 problem first/ })).toBeDisabled();

    await user.click(within(dialog).getByRole('button', { name: /Write the task itself/ }));
    expect(screen.getByRole('tab', { name: /The task/ })).toHaveAttribute('aria-selected', 'true');
  });

  it('names the criterion a warning belongs to, not its id', async () => {
    const rubric = doc().rubric.map((c, index) =>
      index === 1 ? { ...c, levels: ['', 'a', 'b', 'c'] as [string, string, string, string] } : c,
    );
    const { user } = renderBuilder(doc({ rubric }));

    await openGate(user);

    expect(
      within(screen.getByRole('dialog')).getByText(/Criterion 2 is missing a level descriptor/),
    ).toBeInTheDocument();
  });

  it('leaves an info-level remark out of the gate — there is nothing to fix', async () => {
    // `AI_STAGE_OFF_DRAFT_ON`: true, and it changes no answer to "may this be assigned".
    const { user } = renderBuilder(doc({ settings: { ...doc().settings, aiStage: false } }));

    await openGate(user);

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).queryByText(/pre-filled rubric/)).not.toBeInTheDocument();
    expect(within(dialog).getByText(/ready to assign/)).toBeInTheDocument();
  });

  it('summarises what the exercise will do, not only what is wrong with it', async () => {
    const { user } = renderBuilder();

    await openGate(user);

    const dialog = screen.getByRole('dialog');
    expect(
      within(dialog).getByText('1 point to cover, 4 criteria to mark against.'),
    ).toBeInTheDocument();
    expect(within(dialog).getByText('A pass is 8 of 15 points.')).toBeInTheDocument();
    expect(within(dialog).getByText('120–200 words.')).toBeInTheDocument();
    expect(within(dialog).getByText('No time limit.')).toBeInTheDocument();
    // The one line no switch on any step can take back.
    expect(within(dialog).getByText('Every answer is read by a teacher.')).toBeInTheDocument();
  });

  it('reports what the example answer covers, which is the cheapest test of the keywords', async () => {
    const points = [
      { id: 'p1', text: 'Hvor du bor', keywords: ['flyttet til'], required: true },
      { id: 'p2', text: 'Hva du jobber med', keywords: ['jobber som'], required: true },
    ];
    const { user } = renderBuilder(doc({ points }));

    await openGate(user);

    expect(
      within(screen.getByRole('dialog')).getByText(
        'The example answer covers 1 of 2 points — check the keywords for the rest.',
      ),
    ).toBeInTheDocument();
  });

  it('spells out that a single submission cannot be sent back', async () => {
    const { user } = renderBuilder(doc({ settings: { ...doc().settings, revision: 'once' } }));

    await openGate(user);

    expect(
      within(screen.getByRole('dialog')).getByText(/a weak text cannot be sent back/),
    ).toBeInTheDocument();
  });

  it('walks the rail from the foot of a step, ending in the gate', async () => {
    const { user } = renderBuilder();

    await user.click(screen.getByRole('button', { name: 'Next: The frame' }));
    expect(screen.getByRole('tab', { name: /The frame/ })).toHaveAttribute('aria-selected', 'true');

    await user.click(screen.getByRole('button', { name: 'Next: Marking' }));
    await user.click(screen.getByRole('button', { name: 'Next: Flow' }));
    expect(screen.queryByRole('button', { name: /Next:/ })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Review & finish/ }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});

describe('WritingTaskBuilder revert', () => {
  it('is not offered until something has changed', () => {
    renderBuilder();

    expect(
      screen.queryByRole('button', { name: /Undo everything since I opened this/ }),
    ).not.toBeInTheDocument();
  });

  it('puts the document back to what the page opened with, and asks first', async () => {
    // What reloading the page used to do before autosave started writing every edit.
    const { user } = renderBuilder();

    await user.type(screen.getByLabelText('The task itself'), ' Endret.');
    await user.click(screen.getByRole('button', { name: /Undo everything since I opened this/ }));

    // Cancelling leaves the edit alone — this throws work away and says so.
    await user.click(screen.getByRole('button', { name: 'Keep editing' }));
    expect(screen.getByLabelText('The task itself')).toHaveValue(
      'Du har nettopp flyttet til en ny by. Skriv et brev til en venn. Endret.',
    );

    await user.click(screen.getByRole('button', { name: /Undo everything since I opened this/ }));
    await user.click(screen.getByRole('button', { name: 'Put it back' }));

    expect(screen.getByLabelText('The task itself')).toHaveValue(
      'Du har nettopp flyttet til en ny by. Skriv et brev til en venn.',
    );
    expect(
      screen.queryByRole('button', { name: /Undo everything since I opened this/ }),
    ).not.toBeInTheDocument();
  });
});

describe('WritingTaskBuilder autosave', () => {
  it('stops writing once the server refuses the document', async () => {
    // The refusal that prompted this: an exercise whose template row still carried the
    // pre-plan-50 answer schema returned 422 on every save, and the backoff kept sending
    // the identical request every thirty seconds — for as long as the tab stayed open,
    // under a banner that read like a passing network problem.
    vi.mocked(saveWritingTaskAction).mockResolvedValue({
      ok: false,
      error: { code: 'validation', message: 'INVALID_EXERCISE_ANSWERS: /rubric must be string' },
    });
    const { user } = renderBuilder();

    await user.click(screen.getByRole('tab', { name: /The task/ }));
    await user.type(screen.getByLabelText('The task itself'), '!');
    await waitFor(() => expect(saveWritingTaskAction).toHaveBeenCalledTimes(1));

    // Well past the first backoff step (1s) and the debounce.
    await new Promise((resolve) => setTimeout(resolve, 1_500));
    expect(saveWritingTaskAction).toHaveBeenCalledTimes(1);
  });

  it('writes nothing while nobody has edited the document', async () => {
    // Mounting is not an edit, and neither is walking the rail. A builder that saved on
    // mount would take the token it loaded with and hand every second author a conflict
    // over a document nobody changed. Real timers, because the debounce is 800ms.
    const { user } = renderBuilder();

    await user.click(screen.getByRole('tab', { name: /Marking/ }));
    await new Promise((resolve) => setTimeout(resolve, 1_200));

    expect(saveWritingTaskAction).not.toHaveBeenCalled();
  });

  /*
    The listening layer on this builder — the smallest mount of the six (plan 56 phase 6).
    A clip is a stimulus here, so the author gets the switch and the source and no rules:
    there is nothing to time, nothing to gate and no listen worth rationing.
  */
  describe('with audio', () => {
    const listening = (over: Record<string, unknown> = {}): AudioDraft =>
      readAudioDraft(
        { audio: { enabled: true, source: 'asset', assetId: 'a-1', title: 'Intervju', ...over } },
        'writing_task',
      );

    it('offers the switch and the clip, and no rules for hearing it', () => {
      renderBuilder(doc(), listening());

      expect(screen.getByRole('switch', { name: /Listening exercise/ })).toBeChecked();
      expect(screen.getByText('The clip')).toBeInTheDocument();
      expect(screen.queryByText('How they may listen')).not.toBeInTheDocument();
    });

    it('still reports an exercise that says listen with nothing to play', () => {
      // The one finding this template can raise, on the step that owns the clip.
      renderBuilder(doc(), listening({ assetId: '' }));

      expect(
        within(screen.getByRole('tab', { name: /The task/ })).getByText(/problem/),
      ).toBeInTheDocument();
    });

    it('draws nothing at all while the switch is off', () => {
      renderBuilder();

      expect(screen.getByRole('switch', { name: /Listening exercise/ })).not.toBeChecked();
      expect(screen.queryByText('The clip')).not.toBeInTheDocument();
    });
  });
});

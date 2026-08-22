import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import { emptyContent, type WritingTask } from '@/lib/shared-kernel/writing-task';

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

function renderBuilder(exercise: WritingTask = doc()) {
  render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <WritingTaskBuilder exerciseId="ex-1" containerId="module-1" initialExercise={exercise} />
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

  it('counts the blockers on the finish button', () => {
    renderBuilder(doc({ prompt: '', settings: { ...doc().settings, passScore: 99 } }));

    const finish = screen.getAllByRole('button', { name: /Review & finish/ })[0]!;
    expect(within(finish).getByText('2')).toBeInTheDocument();
  });

  it('blocks the gate while a blocker stands, and links to the step that owns it', async () => {
    const { user } = renderBuilder(doc({ prompt: '' }));

    await user.click(screen.getAllByRole('button', { name: /Review & finish/ })[0]!);

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

    await user.click(screen.getAllByRole('button', { name: /Review & finish/ })[0]!);

    expect(
      within(screen.getByRole('dialog')).getByText(/Criterion 2 is missing a level descriptor/),
    ).toBeInTheDocument();
  });

  it('leaves an info-level remark out of the gate — there is nothing to fix', async () => {
    // `AI_STAGE_OFF_DRAFT_ON`: true, and it changes no answer to "may this be assigned".
    const { user } = renderBuilder(doc({ settings: { ...doc().settings, aiStage: false } }));

    await user.click(screen.getAllByRole('button', { name: /Review & finish/ })[0]!);

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).queryByText(/pre-filled rubric/)).not.toBeInTheDocument();
    expect(within(dialog).getByText(/ready to assign/)).toBeInTheDocument();
  });

  it('summarises what the exercise will do, not only what is wrong with it', async () => {
    const { user } = renderBuilder();

    await user.click(screen.getAllByRole('button', { name: /Review & finish/ })[0]!);

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

    await user.click(screen.getAllByRole('button', { name: /Review & finish/ })[0]!);

    expect(
      within(screen.getByRole('dialog')).getByText(
        'The example answer covers 1 of 2 points — check the keywords for the rest.',
      ),
    ).toBeInTheDocument();
  });

  it('spells out that a single submission cannot be sent back', async () => {
    const { user } = renderBuilder(doc({ settings: { ...doc().settings, revision: 'once' } }));

    await user.click(screen.getAllByRole('button', { name: /Review & finish/ })[0]!);

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

    await user.click(screen.getAllByRole('button', { name: /Review & finish/ }).at(-1)!);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});

describe('WritingTaskBuilder autosave', () => {
  it('writes nothing while nobody has edited the document', async () => {
    // Mounting is not an edit, and neither is walking the rail. A builder that saved on
    // mount would take the token it loaded with and hand every second author a conflict
    // over a document nobody changed. Real timers, because the debounce is 800ms.
    const { user } = renderBuilder();

    await user.click(screen.getByRole('tab', { name: /Marking/ }));
    await new Promise((resolve) => setTimeout(resolve, 1_200));

    expect(saveWritingTaskAction).not.toHaveBeenCalled();
  });
});

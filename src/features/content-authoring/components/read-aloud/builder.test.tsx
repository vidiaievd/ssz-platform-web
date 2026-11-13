import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { emptyProsodyLayer } from '@/lib/shared-kernel/prosody';
import { issues, stepState } from '@/lib/shared-kernel/read-aloud';
import { tokenize } from '@/lib/shared-kernel/text';

import type { ReadAloudDocument } from './edits';
import { blankDocument, Intl, LOADED_AT, PAGE_RULES, sampleReadAloud } from './test-support';

vi.mock('@/features/media', () => ({
  ACCEPTED_IMAGE_TYPES: ['image/png'],
  MAX_FILE_SIZE_BYTES: 5_000_000,
  uploadAsset: vi.fn(),
  useMediaAsset: () => ({ data: undefined, isLoading: false }),
}));

vi.mock('next/navigation', () => ({ useParams: () => ({ workspaceId: 'demo-school' }) }));
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
vi.mock('../../actions/read-aloud', () => ({ saveReadAloudAction: vi.fn() }));
vi.mock('../../actions/prosody', () => ({
  loadPromptProsodyAction: vi.fn(),
  savePromptProsodyAction: vi.fn(),
  suggestPromptProsodyAction: vi.fn(),
}));

const { ReadAloudBuilder } = await import('./builder');
const { saveReadAloudAction } = await import('../../actions/read-aloud');
const { loadPromptProsodyAction, savePromptProsodyAction } = await import('../../actions/prosody');

function renderBuilder(
  initial: ReadAloudDocument,
  onDocumentChange?: (d: ReadAloudDocument) => void,
) {
  const view = render(
    <Intl>
      <ReadAloudBuilder
        exerciseId="ex-1"
        containerId="module-1"
        initialExercise={initial}
        onDocumentChange={onDocumentChange}
      />
    </Intl>,
  );
  return { user: userEvent.setup(), ...view };
}

const tab = (name: string) => screen.getByRole('tab', { name: new RegExp(`^\\d?\\s*${name}`) });

describe('ReadAloudBuilder — the rail (RA-B1)', () => {
  it('names the five steps with their subtitles', () => {
    renderBuilder(blankDocument());
    for (const [label, sub] of [
      ['Task', 'mode and material'],
      ['Listen for', "the grader's brief"],
      ['Rubric', 'how it is scored'],
      ['Recording', 'takes and limits'],
      ['Flow', 'review and queue'],
    ] as const) {
      expect(within(tab(label)).getByText(sub)).toBeInTheDocument();
    }
  });

  it('shows the blockers of a blank draft on the rail from the first mount', () => {
    const blank = blankDocument();
    renderBuilder(blank);
    const ctx = { audio: false };
    // The passage and the note — one blocker each; the default rubric is complete.
    expect(stepState(blank, 1, ctx).errs).toBe(1);
    expect(within(tab('Task')).getByText('1 problem')).toBeInTheDocument();
    expect(within(tab('Listen for')).getByText('1 problem')).toBeInTheDocument();
    expect(within(tab('Rubric')).queryByText(/problem/)).not.toBeInTheDocument();
  });

  it('lets a dot follow the document: writing the passage lifts the step-1 blocker', async () => {
    const { user } = renderBuilder(blankDocument());
    await user.type(screen.getByLabelText(/Text to read aloud/), 'Hei på deg');
    expect(within(tab('Task')).queryByText(/problem/)).not.toBeInTheDocument();
    expect(within(tab('Listen for')).getByText('1 problem')).toBeInTheDocument();
  });

  it('opens on the task and moves on with the step navigation', async () => {
    const { user } = renderBuilder(sampleReadAloud());
    expect(tab('Task')).toHaveAttribute('aria-selected', 'true');
    await user.click(screen.getByRole('button', { name: /Next: Listen for/ }));
    expect(tab('Listen for')).toHaveAttribute('aria-selected', 'true');
    await user.click(screen.getByRole('button', { name: /Next: Rubric/ }));
    expect(tab('Rubric')).toHaveAttribute('aria-selected', 'true');
    await user.click(screen.getByRole('button', { name: /Back/ }));
    expect(tab('Listen for')).toHaveAttribute('aria-selected', 'true');
  });

  it('takes the layer into the count: listening on with nothing to play blocks step 1', async () => {
    const { user } = renderBuilder(sampleReadAloud());
    expect(within(tab('Task')).queryByText(/problem/)).not.toBeInTheDocument();
    await user.click(screen.getByRole('switch', { name: /Listening exercise/ }));
    expect(within(tab('Task')).getByText('1 problem')).toBeInTheDocument();
  });
});

describe('ReadAloudBuilder — one document', () => {
  it('reports every edit of every step as the same document', async () => {
    const seen: ReadAloudDocument[] = [];
    const { user } = renderBuilder(sampleReadAloud(), (d) => seen.push(d));
    await user.type(screen.getByLabelText(/^Title/), '!');
    await user.click(screen.getByRole('tab', { name: /Rubric/ }));
    await user.click(
      within(screen.getByRole('region', { name: 'Flyt' })).getByRole('radio', { name: '×2' }),
    );
    const last = seen.at(-1)!;
    expect(last.title).toBe('Les høyt — jobbsøknad!');
    expect(last.rubric.find((c) => c.id === 'flow')?.weight).toBe(2);
    expect(last.updatedAt).toBe(LOADED_AT);
    // What the builder shows is what the kernel judges.
    expect(issues(last, { audio: false }).filter((i) => i.level === 'blocker')).toEqual([]);
  });

  it('has no axe violations', async () => {
    const { container } = renderBuilder(sampleReadAloud());
    expect((await axe.run(container, PAGE_RULES)).violations).toEqual([]);
  });
});

describe('ReadAloudBuilder — steps 4 and 5', () => {
  it('opens recording and flow from the rail, and finishes on the last one (RA-B11, RA-B13)', async () => {
    const { user } = renderBuilder(sampleReadAloud());
    await user.click(tab('Recording'));
    expect(screen.getByRole('heading', { name: 'Recording' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Next: Flow/ }));
    expect(screen.getByRole('heading', { name: 'Flow and review' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Review & finish/ })).toBeInTheDocument();
  });

  it('puts a blocker on the recording step as soon as a range cannot be submitted', async () => {
    const base = sampleReadAloud();
    renderBuilder({
      ...base,
      prompts: [{ ...base.prompts[0]!, minSeconds: 70, maxSeconds: 60 }, base.prompts[1]!],
    });
    expect(within(tab('Recording')).getByText('1 problem')).toBeInTheDocument();
  });
});

describe('ReadAloudBuilder — the gate (RA-B15)', () => {
  async function openGate(user: ReturnType<typeof userEvent.setup>) {
    await user.click(tab('Flow'));
    await user.click(screen.getByRole('button', { name: /Review & finish/ }));
    return screen.findByRole('dialog');
  }

  it('lists a blank draft’s blockers with the fix and the step, and what already passes', async () => {
    const { user } = renderBuilder(blankDocument());
    const dialog = await openGate(user);
    expect(within(dialog).getByText(/Prompt 1 has no text to read/)).toBeInTheDocument();
    expect(within(dialog).getByText(/Prompt 1 tells the teacher nothing/)).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: /Add the material/ })).toBeInTheDocument();
    expect(
      within(dialog).getByRole('button', { name: /Write the listening note/ }),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText(/3 criteria, 9\/15 to pass · 3 shown to the student/),
    ).toBeInTheDocument();
    expect(within(dialog).getByText(/never returns a verdict on its own/)).toBeInTheDocument();
  });

  it('goes to the step that owns a finding', async () => {
    const { user } = renderBuilder(blankDocument());
    const dialog = await openGate(user);
    await user.click(within(dialog).getByRole('button', { name: /Write the listening note/ }));
    expect(tab('Listen for')).toHaveAttribute('aria-selected', 'true');
  });

  it('restates the author’s own numbers for a finished exercise', async () => {
    const base = sampleReadAloud();
    const { user } = renderBuilder({
      ...base,
      audio: {
        ...base.audio,
        audio: {
          ...base.audio.audio,
          enabled: true,
          source: 'link',
          url: 'https://example.com/a.mp3',
          duration: 20,
        },
      },
    });
    const dialog = await openGate(user);
    expect(within(dialog).getByText(/2 prompts — each one its own recording/)).toBeInTheDocument();
    expect(
      within(dialog).getByText('Every prompt tells the grader what to listen for'),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText(/3 takes with listen-back · max 1:00 per recording/),
    ).toBeInTheDocument();
    expect(within(dialog).getByText(/can be sent back for another take/)).toBeInTheDocument();
  });

  it('lists warnings after blockers and leaves the info out', async () => {
    const { user } = renderBuilder(sampleReadAloud());
    const dialog = await openGate(user);
    // No model reading is attached: a warning. «No microphone check» etc. are info and absent.
    expect(within(dialog).getByText(/No model reading attached/)).toBeInTheDocument();
    expect(within(dialog).queryByText(/No microphone check/)).not.toBeInTheDocument();
  });
});

describe('ReadAloudBuilder — saving (RA-B16)', () => {
  beforeEach(() => {
    vi.mocked(saveReadAloudAction).mockResolvedValue({
      ok: true,
      value: { status: 'saved', updatedAt: '2026-10-07T10:00:05.000Z' },
    });
  });
  afterEach(() => vi.clearAllMocks());

  it('saves an edit by itself, both columns, on the token it loaded with', async () => {
    const { user } = renderBuilder(sampleReadAloud());
    await user.type(screen.getByLabelText(/^Title/), '!');
    await vi.waitFor(() => expect(saveReadAloudAction).toHaveBeenCalledTimes(1), {
      timeout: 3_000,
    });
    const [exerciseId, containerId, input] = vi.mocked(saveReadAloudAction).mock.calls[0]!;
    expect([exerciseId, containerId]).toEqual(['ex-1', 'module-1']);
    expect(input.expectedUpdatedAt).toBe(LOADED_AT);
    expect(input.expectedAnswers.prompts['p1aaaa']?.focus).toHaveLength(3);
  });

  it('offers to put the exercise back once something changed, and does', async () => {
    const { user } = renderBuilder(sampleReadAloud());
    expect(screen.queryByRole('button', { name: /Undo everything/ })).not.toBeInTheDocument();
    await user.type(screen.getByLabelText(/^Title/), '!');
    await user.click(screen.getByRole('button', { name: /Undo everything since I opened this/ }));
    await user.click(screen.getByRole('button', { name: 'Put it back' }));
    expect(screen.getByLabelText(/^Title/)).toHaveValue('Les høyt — jobbsøknad');
  });
});

describe('ReadAloudBuilder — the pronunciation guide (plan 86, step 6h.3)', () => {
  const guided = (): ReadAloudDocument => {
    const base = sampleReadAloud();
    return { ...base, pronunciationGuide: { ...base.pronunciationGuide, enabled: true } };
  };

  beforeEach(() => {
    vi.mocked(loadPromptProsodyAction).mockImplementation(async (_exerciseId, promptId) => {
      const prompt = sampleReadAloud().prompts.find((p) => p.id === promptId)!;
      const at = tokenize(prompt.text).findIndex((token) => token.w === 'Kjetil');
      return {
        ok: true,
        value: {
          status: 'loaded',
          view: {
            text: prompt.text,
            notation: prompt.text,
            dropped: 0,
            layer: emptyProsodyLayer(),
            issues: [],
            updatedAt: null,
            lexicon: {
              stresses: [],
              sounds: [],
              unresolved: at === -1 ? [] : [{ i: at, w: 'Kjetil' }],
            },
          },
        },
      };
    });
  });
  afterEach(() => vi.clearAllMocks());

  it('reads nothing and draws no step while the guide is off', () => {
    renderBuilder(sampleReadAloud());
    expect(screen.queryByRole('tab', { name: /Pronunciation/ })).not.toBeInTheDocument();
    expect(loadPromptProsodyAction).not.toHaveBeenCalled();
  });

  it('draws the step second and walks it in the rail order', async () => {
    const { user } = renderBuilder(guided());
    const names = screen.getAllByRole('tab').map((t) => t.textContent ?? '');
    expect(names[1]).toMatch(/Pronunciation/);
    await user.click(screen.getByRole('button', { name: /Next: Pronunciation/ }));
    expect(tab('Pronunciation')).toHaveAttribute('aria-selected', 'true');
    await user.click(screen.getByRole('button', { name: /Next: Listen for/ }));
    expect(tab('Listen for')).toHaveAttribute('aria-selected', 'true');
  });

  it('reads each passage and blocks on a word the dictionary does not know', async () => {
    const { user } = renderBuilder(guided());
    await vi.waitFor(() =>
      expect(within(tab('Pronunciation')).getByText('1 problem')).toBeInTheDocument(),
    );
    expect(loadPromptProsodyAction).toHaveBeenCalledTimes(2);
    await user.click(tab('Pronunciation'));
    expect(screen.getByText('Not in the dictionary: Kjetil')).toBeInTheDocument();
    expect(screen.getByText(/«Kjetil» is not in the dictionary/)).toBeInTheDocument();
  });

  it('asks for a sentence end once «Melody» is offered', async () => {
    const { user } = renderBuilder(guided());
    await user.click(tab('Pronunciation'));
    await user.click(screen.getByRole('checkbox', { name: 'Melody' }));
    await vi.waitFor(() =>
      expect(screen.getAllByText(/no end of a group/).length).toBeGreaterThan(0),
    );
  });

  it('has no axe violations on the step', async () => {
    const { user, container } = renderBuilder(guided());
    await user.click(tab('Pronunciation'));
    await vi.waitFor(() =>
      expect(screen.getByText('Not in the dictionary: Kjetil')).toBeInTheDocument(),
    );
    expect((await axe.run(container, PAGE_RULES)).violations).toEqual([]);
  });

  /** «Kjetil» is in the second sentence of the first passage. */
  const openKjetil = async (user: ReturnType<typeof renderBuilder>['user']) => {
    const [list] = await screen.findAllByRole('list', { name: 'Sentences of the passage' });
    await user.click(within(list!).getAllByRole('button')[1]!);
    await user.click(screen.getByRole('button', { name: 'Kjetil' }));
  };

  it('settles a word in the editor at once and saves the layer on its own (6h.3b)', async () => {
    vi.mocked(savePromptProsodyAction).mockImplementation(async (_exerciseId, promptId, input) => {
      const prompt = sampleReadAloud().prompts.find((p) => p.id === promptId)!;
      return {
        ok: true,
        value: {
          status: 'saved',
          view: {
            text: prompt.text,
            notation: prompt.text,
            dropped: 0,
            layer: input.layer,
            issues: [],
            updatedAt: '2026-11-04T12:00:00.000Z',
            lexicon: { stresses: [], sounds: [], unresolved: [] },
          },
        },
      };
    });
    const { user } = renderBuilder(guided());
    await user.click(tab('Pronunciation'));
    await openKjetil(user);
    await user.click(screen.getByRole('button', { name: 'no stress' }));
    // The draft is judged before it is saved: the blocker goes at once.
    expect(screen.queryByText(/«Kjetil» is not in the dictionary/)).not.toBeInTheDocument();
    await vi.waitFor(() => expect(savePromptProsodyAction).toHaveBeenCalledTimes(1), {
      timeout: 2000,
    });
    const [, , input] = vi.mocked(savePromptProsodyAction).mock.calls[0]!;
    expect(input.expectedUpdatedAt).toBeNull();
    expect(input.layer.unstressed).toEqual([
      expect.objectContaining({ w: 'Kjetil', source: 'teacher' }),
    ]);
    expect(await screen.findByText('Marks saved')).toBeInTheDocument();
  });

  it('drops the edit and reads again when another window saved first', async () => {
    vi.mocked(savePromptProsodyAction).mockResolvedValue({
      ok: true,
      value: { status: 'conflict', currentUpdatedAt: '2026-11-04T12:00:00.000Z' },
    });
    const { user } = renderBuilder(guided());
    await user.click(tab('Pronunciation'));
    await openKjetil(user);
    await user.click(screen.getByRole('button', { name: 'no stress' }));
    expect(
      await screen.findByText(/changed in another window/, {}, { timeout: 2000 }),
    ).toBeInTheDocument();
    expect(loadPromptProsodyAction).toHaveBeenCalledTimes(3);
    // The stored layer is back, and with it the blocker.
    await vi.waitFor(() =>
      expect(screen.getByText(/«Kjetil» is not in the dictionary/)).toBeInTheDocument(),
    );
  });

  it('drops the step from the rail when the guide is switched off', async () => {
    const { user } = renderBuilder(guided());
    await user.click(screen.getByRole('switch', { name: /Pronunciation guide/ }));
    expect(screen.queryByRole('tab', { name: /Pronunciation/ })).not.toBeInTheDocument();
    expect(tab('Task')).toHaveAttribute('aria-selected', 'true');
  });
});

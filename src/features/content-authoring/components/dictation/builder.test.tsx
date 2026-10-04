import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import {
  audioIssuesOf,
  emptyContent,
  issues,
  newSegment,
  stepState,
  type DictationContent,
} from '@/lib/shared-kernel/dictation';

import type { DictationDocument } from './edits';

vi.mock('@/features/media', () => ({
  useMediaAsset: () => ({ data: undefined }),
  uploadAsset: vi.fn(),
}));
vi.mock('../../actions/dictation', () => ({ saveDictationAction: vi.fn() }));

const { DictationBuilder } = await import('./builder');
const { saveDictationAction } = await import('../../actions/dictation');

// A fragment mounted alone has no landmarks; that rule is the page's, not the builder's.
const PAGE_RULES = { rules: { region: { enabled: false }, 'color-contrast': { enabled: false } } };
const LOADED_AT = '2026-10-04T10:00:00.000Z';

/** A dictation with nothing left to fix. */
function finished(patch: Partial<DictationContent> = {}): DictationContent {
  const base = emptyContent('nb', 'Skriv det du hører.');
  return {
    ...base,
    title: 'Diktat: kj',
    audio: {
      ...base.audio,
      source: 'link',
      url: 'https://example.com/diktat.mp3',
      title: 'Diktat',
      duration: 30,
    },
    segments: [
      {
        ...newSegment(),
        id: 's1',
        text: 'Jeg hørte kjøkkenet i går.',
        audio: { start: 0, end: 12 },
        why: 'kj, ikke sj.',
        focus: [{ id: 'f1', wordIndex: 2, why: 'kj + øk' }],
      },
      {
        ...newSegment(),
        id: 's2',
        text: 'Hun gikk hjem sammen med dem.',
        audio: { start: 12, end: 26 },
        why: 'Dobbel m.',
        focus: [],
      },
    ],
    ...patch,
  };
}

const doc = (content: DictationContent = finished()): DictationDocument => ({
  ...content,
  updatedAt: LOADED_AT,
});

function renderBuilder(document: DictationDocument = doc()) {
  const view = render(
    <QueryClientProvider client={new QueryClient()}>
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <DictationBuilder exerciseId="ex-1" containerId="module-1" initialExercise={document} />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
  return { user: userEvent.setup(), ...view };
}

const stepTab = (name: string) => screen.getByRole('tab', { name: new RegExp(`^\\d?\\s*${name}`) });

async function openGate(user: ReturnType<typeof userEvent.setup>) {
  await user.click(stepTab('Difficulty'));
  await user.click(screen.getByRole('button', { name: /Review & finish/ }));
}

beforeEach(() => {
  vi.mocked(saveDictationAction).mockResolvedValue({
    ok: true,
    value: { status: 'saved', updatedAt: '2026-10-04T10:00:05.000Z' },
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('DictationBuilder — rail', () => {
  it('names the four steps with their subtitles', () => {
    renderBuilder();
    for (const [label, sub] of [
      ['Recording', 'the whole prompt'],
      ['Key', 'what is said'],
      ['Marking', 'errors and reasons'],
      ['Difficulty', 'dials and delivery'],
    ] as const) {
      expect(within(stepTab(label)).getByText(sub)).toBeInTheDocument();
    }
  });

  it('shows the blockers of a blank draft on the rail from the first mount, step 3 empty (AC-B1)', () => {
    const blank = doc(emptyContent('nb'));
    renderBuilder(blank);
    // The type's own blockers on step 1 (no title) plus the layer's (nothing to play).
    expect(within(stepTab('Recording')).getByText('2')).toBeInTheDocument();
    const keyErrors = stepState(blank, 2).errs;
    expect(keyErrors).toBeGreaterThan(0);
    expect(within(stepTab('Key')).getByText(String(keyErrors))).toBeInTheDocument();
    expect(within(stepTab('Marking')).getByText('empty')).toBeInTheDocument();
  });

  it('opens on the recording and moves on with the step navigation', async () => {
    const { user } = renderBuilder();
    expect(stepTab('Recording')).toHaveAttribute('aria-selected', 'true');
    await user.click(screen.getByRole('button', { name: /Next: Key/ }));
    expect(stepTab('Key')).toHaveAttribute('aria-selected', 'true');
  });

  it('keeps «estimated» on a split sentence through a trip to another step (AC-B2)', async () => {
    const blank = finished({ segments: [newSegment()] });
    const { user } = renderBuilder(doc(blank));
    await user.click(stepTab('Key'));
    await user.type(
      screen.getByPlaceholderText(/Paste the transcript/),
      'Jeg hørte kjøkkenet i går. Hun gikk hjem sammen med dem.',
    );
    await user.click(screen.getByRole('button', { name: /Split into 2 segments/ }));
    expect(screen.getAllByText('estimated')).toHaveLength(2);

    await user.click(stepTab('Marking'));
    await user.click(stepTab('Key'));
    expect(screen.getAllByText('estimated')).toHaveLength(2);
  });
});

describe('DictationBuilder — gate', () => {
  it('refuses a blank draft and names each blocker with its fix (AC-X2)', async () => {
    const { user } = renderBuilder(doc(emptyContent('nb')));
    await openGate(user);

    expect(screen.getByRole('button', { name: /Fix \d+ problems? first/ })).toBeDisabled();
    expect(screen.getByText('Name it')).toBeInTheDocument();
    expect(screen.getByText('Write the key')).toBeInTheDocument();
  });

  it('lists exactly the kernel’s issues and the layer’s — what the preflight runs (AC-X1)', async () => {
    const broken = doc(
      finished({
        audio: { ...finished().audio, settings: { ...finished().audio.settings, plays: 1 } },
        segments: [...finished().segments, { ...newSegment(), text: 'Tre ord her.', why: '' }],
        settings: { ...finished().settings, attempts: 1, revealKey: false },
      }),
    );
    const { user } = renderBuilder(broken);
    await openGate(user);

    const dialog = screen.getByRole('dialog');
    const rows = within(dialog)
      .getAllByRole('button')
      .filter((b) => b.closest('li') !== null);
    expect(rows).toHaveLength(
      issues(broken).length +
        // The gate lists what blocks or warns; an `info` line is the step's own to say.
        audioIssuesOf(broken).filter((issue) => issue.level !== 'info').length,
    );
    expect(issues(broken).length).toBeGreaterThan(2);
  });

  it('goes to the step that owns a row', async () => {
    const { user } = renderBuilder(doc(finished({ title: '' })));
    await openGate(user);
    await user.click(screen.getByText(/The exercise has no title/));
    expect(stepTab('Recording')).toHaveAttribute('aria-selected', 'true');
  });

  it('calls an open transcript a blocker (AC-B9)', async () => {
    const base = finished();
    const { user } = renderBuilder(
      doc({
        ...base,
        audio: { ...base.audio, settings: { ...base.audio.settings, transcriptWhen: 'always' } },
      }),
    );
    await openGate(user);
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText(/it is the answer key/)).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: /Fix 1 problem first/ })).toBeDisabled();
  });

  it('lists what passes on a finished exercise (the prototype’s five lines)', async () => {
    const { user } = renderBuilder();
    await openGate(user);

    expect(screen.getByText('2 sentences, 11 words, each one its own verdict')).toBeInTheDocument();
    expect(screen.getByText('Every sentence says what went wrong')).toBeInTheDocument();
    expect(screen.getByText('1 focus word carries its own reason')).toBeInTheDocument();
    expect(screen.getByText('The transcript stays closed until the check')).toBeInTheDocument();
    expect(screen.getByText('Every sentence can be replayed on its own')).toBeInTheDocument();
  });
});

describe('DictationBuilder — autosave', () => {
  it('writes both columns with the token it loaded with', async () => {
    const { user } = renderBuilder();
    await user.click(stepTab('Difficulty'));
    await user.click(screen.getByRole('switch', { name: /Show how many words/ }));

    await vi.waitFor(() => expect(saveDictationAction).toHaveBeenCalled(), { timeout: 3000 });
    const [, , input] = vi.mocked(saveDictationAction).mock.calls[0]!;
    expect(input.expectedUpdatedAt).toBe(LOADED_AT);
    expect(input.content.settings.showWordCount).toBe(true);
    // The key goes up with the answers, or every check would find nothing to compare with.
    expect(Object.keys(input.expectedAnswers.segments)).toEqual(['s1', 's2']);
    expect(input.expectedAnswers.segments['s1']!.text).toBe('Jeg hørte kjøkkenet i går.');
    expect(JSON.stringify(input.content)).not.toContain('kjøkkenet');
  });
});

describe('DictationBuilder — accessibility (AC-X6)', () => {
  it('has no axe violations on any of the four steps, nor on the gate', async () => {
    const { user, baseElement } = renderBuilder();
    for (const step of ['Recording', 'Key', 'Marking', 'Difficulty']) {
      await user.click(stepTab(step));
      expect((await axe.run(baseElement, PAGE_RULES)).violations).toEqual([]);
    }
    await user.click(screen.getByRole('button', { name: /Review & finish/ }));
    expect((await axe.run(baseElement, PAGE_RULES)).violations).toEqual([]);
  }, 20_000);
});

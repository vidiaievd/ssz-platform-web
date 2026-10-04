import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import { readAudioDraft } from '@/lib/shared-kernel/audio';
import {
  emptyContent,
  issues,
  TEMPLATE_CODE,
  type HighlightInTextContent,
} from '@/lib/shared-kernel/highlight-in-text';
import { exercise, question } from '@/lib/shared-kernel/highlight-in-text/fixtures.test-support';

import type { HighlightInTextDocument } from './edits';

vi.mock('@/features/media', () => ({
  useMediaAsset: () => ({ data: undefined }),
  uploadAsset: vi.fn(),
}));
vi.mock('../../actions/highlight-in-text', () => ({ saveHighlightInTextAction: vi.fn() }));

const { HighlightInTextBuilder } = await import('./builder');
const { saveHighlightInTextAction } = await import('../../actions/highlight-in-text');

// A fragment mounted alone has no landmarks; that rule is the page's, not the builder's.
const PAGE_RULES = { rules: { region: { enabled: false } } };
const LOADED_AT = '2026-10-04T10:00:00.000Z';

function doc(content: HighlightInTextContent = exercise()): HighlightInTextDocument {
  return { ...content, updatedAt: LOADED_AT, audio: readAudioDraft({}, TEMPLATE_CODE) };
}

function renderBuilder(document: HighlightInTextDocument = doc()) {
  const view = render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <HighlightInTextBuilder exerciseId="ex-1" containerId="module-1" initialExercise={document} />
    </NextIntlClientProvider>,
  );
  return { user: userEvent.setup(), ...view };
}

const stepTab = (name: string) => screen.getByRole('tab', { name: new RegExp(`^\\d?\\s*${name}`) });

async function openGate(user: ReturnType<typeof userEvent.setup>) {
  await user.click(stepTab('Difficulty'));
  await user.click(screen.getByRole('button', { name: /Review & finish/ }));
}

beforeEach(() => {
  vi.mocked(saveHighlightInTextAction).mockResolvedValue({
    ok: true,
    value: { status: 'saved', updatedAt: '2026-10-04T10:00:05.000Z' },
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('HighlightInTextBuilder — rail', () => {
  it('names the four steps with their subtitles', () => {
    renderBuilder();
    for (const [label, sub] of [
      ['Text', 'one passage'],
      ['Questions', 'what to mark'],
      ['Feedback', 'missed and extra'],
      ['Difficulty', 'dials and delivery'],
    ] as const) {
      expect(within(stepTab(label)).getByText(sub)).toBeInTheDocument();
    }
  });

  it('shows the blockers of a blank draft on steps 1 and 2 with their counts, step 3 empty (AC-A1, Q6-A)', () => {
    renderBuilder(doc(emptyContent()));
    // HT_NO_TEXT + HT_NO_TITLE; HT_QUESTION_NO_PROMPT.
    expect(within(stepTab('Text')).getByText('2')).toBeInTheDocument();
    expect(within(stepTab('Questions')).getByText('1')).toBeInTheDocument();
    expect(within(stepTab('Feedback')).getByText('empty')).toBeInTheDocument();
  });

  it('opens on the text and moves on with the step navigation', async () => {
    const { user } = renderBuilder();
    expect(stepTab('Text')).toHaveAttribute('aria-selected', 'true');
    await user.click(screen.getByRole('button', { name: /Next: Questions/ }));
    expect(stepTab('Questions')).toHaveAttribute('aria-selected', 'true');
  });
});

describe('HighlightInTextBuilder — gate', () => {
  it('refuses a blank draft and names each blocker with its fix (AC-X2)', async () => {
    const { user } = renderBuilder(doc(emptyContent()));
    await openGate(user);

    expect(screen.getByRole('button', { name: /Fix 3 problems first/ })).toBeDisabled();
    expect(screen.getByText('There is no text to mark in.')).toBeInTheDocument();
    expect(screen.getByText('Paste the text')).toBeInTheDocument();
    expect(screen.getByText('Question 1 — It has no wording.')).toBeInTheDocument();
  });

  it('lists exactly the kernel issues — the same codes the preflight runs (AC-X1)', async () => {
    const broken = doc(
      exercise({
        questions: [
          question('q1', {
            prompt: 'Find them.',
            spans: exercise().questions[0]!.spans.slice(0, 2),
            missHint: '',
          }),
        ],
        settings: { ...exercise().settings, penalty: 'off', showCount: true },
      }),
    );
    const { user } = renderBuilder(broken);
    await openGate(user);

    const dialog = screen.getByRole('dialog');
    const rows = within(dialog)
      .getAllByRole('button')
      .filter((b) => b.closest('li') !== null);
    expect(rows).toHaveLength(issues(broken).length);
  });

  it('goes to the step that owns a row', async () => {
    const { user } = renderBuilder(doc(exercise({ title: '' })));
    await openGate(user);
    await user.click(screen.getByText(/The exercise has no title/));
    expect(stepTab('Text')).toHaveAttribute('aria-selected', 'true');
  });

  it('lists what passes on a finished exercise (the prototype’s five lines)', async () => {
    const { user } = renderBuilder();
    await openGate(user);

    expect(screen.getByText(/2 questions over \d+ words, 14 marks in the key/)).toBeInTheDocument();
    expect(screen.getByText('Every question explains what was missed')).toBeInTheDocument();
    expect(screen.getByText('14 marks carry their own reason')).toBeInTheDocument();
    expect(
      screen.getByText('An extra mark costs — marking everything does not pass'),
    ).toBeInTheDocument();
    expect(screen.getByText('No marks are floating loose after text edits')).toBeInTheDocument();
  });
});

describe('HighlightInTextBuilder — autosave', () => {
  it('writes both columns with the token it loaded with', async () => {
    const { user } = renderBuilder();
    await user.click(stepTab('Difficulty'));
    await user.click(screen.getByRole('switch', { name: /Say how many marks are expected/ }));

    await vi.waitFor(() => expect(saveHighlightInTextAction).toHaveBeenCalled(), { timeout: 3000 });
    const [, , input] = vi.mocked(saveHighlightInTextAction).mock.calls[0]!;
    expect(input.expectedUpdatedAt).toBe(LOADED_AT);
    expect(input.content.settings.showCount).toBe(true);
    // The key goes up with the content, or every check would find nothing to find.
    expect(Object.keys(input.expectedAnswers.questions)).toEqual(['q1', 'q2']);
    expect(input.expectedAnswers.questions['q1']!.spans).toHaveLength(8);
  });
});

describe('HighlightInTextBuilder — accessibility (AC-X6)', () => {
  // Five full-page axe runs in one test: about three seconds alone, past vitest's default
  // five under the load of the whole suite. The time is axe's, not the builder's.
  it('has no axe violations on any of the four steps, nor on the gate', async () => {
    const { user, baseElement } = renderBuilder();
    for (const step of ['Text', 'Questions', 'Feedback', 'Difficulty']) {
      await user.click(stepTab(step));
      expect((await axe.run(baseElement, PAGE_RULES)).violations).toEqual([]);
    }
    await user.click(screen.getByRole('button', { name: /Review & finish/ }));
    expect((await axe.run(baseElement, PAGE_RULES)).violations).toEqual([]);
  }, 20_000);
});

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import { readAudioDraft } from '@/lib/shared-kernel/audio';
import {
  issues,
  TEMPLATE_CODE,
  type SortIntoBucketsContent,
} from '@/lib/shared-kernel/sort-into-buckets';
import {
  EI,
  EN,
  exercise,
  item,
} from '@/lib/shared-kernel/sort-into-buckets/fixtures.test-support';

import type { SortIntoBucketsDocument } from './edits';

vi.mock('@/features/media', () => ({
  useMediaAsset: () => ({ data: undefined }),
  uploadAsset: vi.fn(),
}));
vi.mock('../../actions/sort-into-buckets', () => ({ saveSortIntoBucketsAction: vi.fn() }));

const { SortIntoBucketsBuilder } = await import('./builder');
const { saveSortIntoBucketsAction } = await import('../../actions/sort-into-buckets');

// A fragment mounted alone has no landmarks; that rule is the page's, not the builder's.
const PAGE_RULES = { rules: { region: { enabled: false } } };

const LOADED_AT = '2026-10-03T10:00:00.000Z';

function doc(overrides: Partial<SortIntoBucketsContent> = {}): SortIntoBucketsDocument {
  return { updatedAt: LOADED_AT, audio: readAudioDraft({}, TEMPLATE_CODE), ...exercise(overrides) };
}

function renderBuilder(document: SortIntoBucketsDocument = doc()) {
  const view = render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <SortIntoBucketsBuilder
        exerciseId="ex-1"
        containerId="module-1"
        targetLanguage="nb"
        initialExercise={document}
      />
    </NextIntlClientProvider>,
  );
  return { user: userEvent.setup(), ...view };
}

async function openGate(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('tab', { name: /Delivery/ }));
  await user.click(screen.getByRole('button', { name: /Review & finish/ }));
}

beforeEach(() => {
  vi.mocked(saveSortIntoBucketsAction).mockResolvedValue({
    ok: true,
    value: { status: 'saved', updatedAt: '2026-10-03T10:00:05.000Z' },
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('SortIntoBucketsBuilder', () => {
  it('opens on the buckets with a clean rail when nothing is left to fix', () => {
    renderBuilder();

    expect(screen.getByRole('tab', { name: /Buckets/ })).toHaveAttribute('aria-selected', 'true');
    for (const step of ['Buckets', 'Items', 'Explanations', 'Delivery']) {
      expect(
        within(screen.getByRole('tab', { name: new RegExp(step) })).getByText('ready'),
      ).toBeInTheDocument();
    }
  });

  it('shows an untouched board as empty on steps 1–3, yet refuses it at the gate (AC-X11)', async () => {
    const { user } = renderBuilder(
      doc({
        title: '',
        buckets: [
          { id: 'b1', label: '', rule: '' },
          { id: 'b2', label: '', rule: '' },
        ],
        items: [item('a', '', null), item('b', '', null), item('c', '', null)],
        fb: {},
      }),
    );

    for (const step of ['Buckets', 'Items', 'Explanations']) {
      expect(
        within(screen.getByRole('tab', { name: new RegExp(step) })).getByText('empty'),
      ).toBeInTheDocument();
    }

    await openGate(user);
    expect(screen.getByRole('button', { name: /Fix \d+ problems? first/ })).toBeDisabled();
  });

  it('lists blockers first, names the item, and goes to the step that owns it (AC-G1, AC-G2)', async () => {
    const { user } = renderBuilder(doc({ fb: { ...exercise().fb, i1: { def: '', ov: {} } } }));

    await openGate(user);

    const blocker = screen.getByText(/Item 1 — Explain why a wrong bucket is wrong/);
    expect(screen.getByRole('button', { name: /Fix 1 problem first/ })).toBeDisabled();

    await user.click(blocker);
    expect(screen.getByRole('tab', { name: /Explanations/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  it('lists what passes when nothing blocks, with the four settings in numbers (AC-G3)', async () => {
    const { user } = renderBuilder();

    await openGate(user);

    expect(screen.getByText(/Nothing standing in the way/)).toBeInTheDocument();
    expect(screen.getByText('6 items in 3 buckets')).toBeInTheDocument();
    expect(screen.getByText('Spread: en 2 · ei 2 · et 2')).toBeInTheDocument();
    expect(
      screen.getByText('Pass mark 70% — 5 of 6 items right on the first check'),
    ).toBeInTheDocument();
    expect(screen.getByText('Unlimited checks')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Looks good' })).toBeEnabled();
  });

  it("shows the kernel's own list in the gate: same codes as the server preflight (AC-X1)", async () => {
    const broken = doc({ items: [item('i1', 'bil', EN.id), item('i2', 'bok', EI.id)] });
    const { user } = renderBuilder(broken);

    await openGate(user);

    const blockers = issues(broken).filter((issue) => issue.level === 'blocker');
    // One row per blocker: the dialog is a filter over the issue list and adds none.
    const rows = screen.getAllByText(/Go to step \d/);
    const warnings = issues(broken).filter((issue) => issue.level === 'warning');
    expect(rows).toHaveLength(blockers.length + warnings.length);
  });

  it('passes an edit on to the autosave, with the buckets in both columns', async () => {
    const { user } = renderBuilder();

    await user.click(screen.getByRole('tab', { name: /Delivery/ }));
    await user.click(screen.getByRole('switch', { name: /Shuffle the items/ }));

    await vi.waitFor(() => expect(saveSortIntoBucketsAction).toHaveBeenCalled(), { timeout: 3000 });
    const [, , input] = vi.mocked(saveSortIntoBucketsAction).mock.calls[0]!;
    expect(input.expectedUpdatedAt).toBe(LOADED_AT);
    expect(input.content.settings.shuffle).toBe(false);
    // The key goes up with the content or the board would grade every tile wrong.
    expect(Object.keys(input.expectedAnswers.items)).toHaveLength(6);
  });

  it('has no axe violations on any of the four steps, nor on the gate', async () => {
    const { user, baseElement } = renderBuilder();

    for (const step of ['Buckets', 'Items', 'Explanations', 'Delivery']) {
      await user.click(screen.getByRole('tab', { name: new RegExp(step) }));
      expect((await axe.run(baseElement, PAGE_RULES)).violations).toEqual([]);
    }
    await user.click(screen.getByRole('button', { name: /Review & finish/ }));
    expect((await axe.run(baseElement, PAGE_RULES)).violations).toEqual([]);
  });
});

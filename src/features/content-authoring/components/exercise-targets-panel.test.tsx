import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';

import type { ExerciseTargets, TargetSuggestions } from '../types';

const toastError = vi.fn();
vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: (...args: unknown[]) => toastError(...args) },
}));

const { ExerciseTargetsPanel } = await import('./exercise-targets-panel');

const TARGETS: ExerciseTargets = {
  exerciseId: 'ex-1',
  templateCode: 'word_bank_gap_fill',
  addressable: true,
  items: [
    {
      itemKey: 's1#5',
      label: 'G1 — huset',
      targets: [
        {
          atomType: 'grammar_rule_atom',
          atomId: 'atom-1',
          role: 'focus',
          atomTitle: 'Definite singular',
          track: 'grammar',
          broken: null,
        },
      ],
    },
    { itemKey: 's1#9', label: 'G2 — bøkene', targets: [] },
    {
      itemKey: 's2#3',
      label: 'G3 — bilen',
      targets: [
        {
          atomType: 'vocabulary_item',
          atomId: 'word-9',
          role: 'context',
          atomTitle: 'bil',
          track: 'lexis',
          broken: 'item_missing',
        },
      ],
    },
  ],
};

const SUGGESTIONS: TargetSuggestions = {
  exerciseId: 'ex-1',
  templateCode: 'word_bank_gap_fill',
  items: [
    {
      itemKey: 's1#9',
      label: 'G2 — bøkene',
      alreadyAddressed: false,
      suggestions: [
        {
          atomType: 'vocabulary_item',
          atomId: 'word-2',
          title: 'bok',
          track: 'lexis',
          role: 'context',
          reason: 'word_inflected',
          confident: true,
        },
      ],
    },
  ],
  rulesWithoutAtoms: [{ ruleId: 'rule-9', title: 'Passiv' }],
};

const fetchMock = vi.fn();
const puts: Array<{ url: string; body: unknown }> = [];

function renderPanel(targets: ExerciseTargets = TARGETS) {
  puts.length = 0;
  fetchMock.mockImplementation((url: string, init?: RequestInit) => {
    const href = String(url);
    if ((init?.method ?? 'GET') === 'PUT') {
      puts.push({ url: href, body: JSON.parse(String(init?.body)) });
      return Promise.resolve(new Response(null, { status: 204 }));
    }
    if (href.endsWith('/targets')) {
      return Promise.resolve(new Response(JSON.stringify(targets), { status: 200 }));
    }
    if (href.endsWith('/target-suggestions')) {
      return Promise.resolve(new Response(JSON.stringify(SUGGESTIONS), { status: 200 }));
    }
    // The rule pool, and the atoms of each rule in it.
    return Promise.resolve(new Response('[]', { status: 200 }));
  });

  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <ExerciseTargetsPanel exerciseId="ex-1" />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
  return { user: userEvent.setup() };
}

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('ExerciseTargetsPanel', () => {
  /** The unaddressed gap is the one worth seeing — it is the work left to do. */
  it('lists every item, including the ones that say nothing about themselves', async () => {
    renderPanel();

    expect(await screen.findByText('G1 — huset')).toBeInTheDocument();
    expect(screen.getByText('G2 — bøkene')).toBeInTheDocument();
    expect(screen.getByText(/says nothing about itself yet/i)).toBeInTheDocument();
  });

  /** A target silently dropped leaves an author believing a gap is covered. */
  it('reports a target whose gap has been edited away', async () => {
    renderPanel();

    expect(await screen.findByText(/the gap this addressed is gone/i)).toBeInTheDocument();
  });

  it('sends the whole statement when a suggestion is accepted', async () => {
    const { user } = renderPanel();

    await user.click(await screen.findByRole('button', { name: /bok/ }));

    await waitFor(() => expect(puts).toHaveLength(1));
    expect(puts[0]?.body).toEqual({
      itemKey: 's1#9',
      targets: [{ atomType: 'vocabulary_item', atomId: 'word-2', role: 'context' }],
    });
  });

  /** Replaces, never appends: the statement is "this gap is about these atoms". */
  it('keeps the targets already on the item when another is added', async () => {
    const { user } = renderPanel({
      ...TARGETS,
      items: [
        {
          ...TARGETS.items[0]!,
          itemKey: 's1#9',
          label: 'G2 — bøkene',
        },
      ],
    });

    await user.click(await screen.findByRole('button', { name: /bok/ }));

    await waitFor(() => expect(puts).toHaveLength(1));
    expect(puts[0]?.body).toEqual({
      itemKey: 's1#9',
      targets: [
        { atomType: 'grammar_rule_atom', atomId: 'atom-1', role: 'focus' },
        { atomType: 'vocabulary_item', atomId: 'word-2', role: 'context' },
      ],
    });
  });

  it('switches a role in place rather than making the author retype the target', async () => {
    const { user } = renderPanel();

    await user.click(
      await screen.findByRole('button', { name: /switch the role of definite singular/i }),
    );

    await waitFor(() => expect(puts).toHaveLength(1));
    expect(puts[0]?.body).toEqual({
      itemKey: 's1#5',
      targets: [{ atomType: 'grammar_rule_atom', atomId: 'atom-1', role: 'context' }],
    });
  });

  /** The one actionable sentence when the suggester has nothing to offer. */
  it('names the rules nobody has cut into atoms yet', async () => {
    renderPanel();

    expect(await screen.findByText(/nobody has cut into atoms yet: Passiv/i)).toBeInTheDocument();
  });
});

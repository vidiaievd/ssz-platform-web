import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import type { GrammarRule, GrammarRuleAtom } from '@/features/content/types';

const toastError = vi.fn();
vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: (...args: unknown[]) => toastError(...args) },
}));

const { GrammarAtomsPanel, slugify } = await import('./grammar-atoms-panel');

function atom(over: Partial<GrammarRuleAtom> = {}): GrammarRuleAtom {
  return {
    id: 'atom-1',
    grammarRuleId: 'rule-1',
    key: 'definite-plural',
    title: 'Definite plural (-ene)',
    description: null,
    track: 'grammar',
    position: 0,
    createdAt: '2026-09-13T00:00:00.000Z',
    updatedAt: '2026-09-13T00:00:00.000Z',
    ...over,
  };
}

const OTHER_RULES: GrammarRule[] = [
  {
    id: 'rule-2',
    title: 'Adjektiv',
    targetLanguage: 'nb',
    createdAt: '2026-09-13T00:00:00.000Z',
    containerItemId: 'ci-2',
  },
];

const fetchMock = vi.fn();

function renderPanel(atoms: GrammarRuleAtom[]) {
  fetchMock.mockImplementation((url: string, init?: RequestInit) => {
    if ((init?.method ?? 'GET') === 'GET') {
      return Promise.resolve(new Response(JSON.stringify(atoms), { status: 200 }));
    }
    if ((init?.method ?? 'GET') === 'POST') {
      return Promise.resolve(new Response(JSON.stringify({ atomId: 'atom-new' }), { status: 201 }));
    }
    return Promise.resolve(new Response(null, { status: 204 }));
  });

  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <GrammarAtomsPanel ruleId="rule-1" otherRules={OTHER_RULES} />
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

describe('slugify', () => {
  /** The backend takes kebab-case only, and an author types a title, not a slug. */
  it('turns a written title into a key the backend accepts', () => {
    expect(slugify('Definite plural (-ene)')).toBe('definite-plural-ene');
    expect(slugify('Kjønn på substantiv')).toBe('kjonn-pa-substantiv');
  });
});

describe('GrammarAtomsPanel', () => {
  /** An uncut rule is a state, not an error: it behaves exactly as it did before. */
  it('says what an uncut rule means rather than showing an empty list', async () => {
    renderPanel([]);

    expect(
      await screen.findByText(/counts as one thing a learner either knows or does not/i),
    ).toBeInTheDocument();
  });

  it('shows the track of each atom, because lexis inside a grammar rule is the surprising case', async () => {
    renderPanel([atom(), atom({ id: 'atom-2', key: 'gender', title: 'Gender', track: 'lexis' })]);

    expect(await screen.findByText('Definite plural (-ene)')).toBeInTheDocument();
    expect(screen.getByText('Lexis')).toBeInTheDocument();
    expect(screen.getByText('Grammar')).toBeInTheDocument();
  });

  /** The key follows the title until the author takes it over — see `AtomForm`. */
  it('derives the key from the title while the author has not typed one', async () => {
    const { user } = renderPanel([]);

    await user.click(await screen.findByRole('button', { name: /add an atom/i }));
    await user.type(screen.getByLabelText(/what the atom is/i), 'Definite plural');

    expect(screen.getByLabelText(/^key/i)).toHaveValue('definite-plural');
  });

  /** Reordering names every living atom: a subset would leave stale positions behind. */
  it('sends every atom when one is moved down', async () => {
    const { user } = renderPanel([atom(), atom({ id: 'atom-2', key: 'gender', title: 'Gender' })]);

    await user.click(
      await screen.findByRole('button', { name: /move definite plural \(-ene\) down/i }),
    );

    await waitFor(() => {
      const call = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/atoms/reorder')) as
        | [string, RequestInit]
        | undefined;
      expect(call).toBeDefined();
      expect(JSON.parse(String(call?.[1].body))).toEqual({
        items: [
          { atomId: 'atom-2', position: 0 },
          { atomId: 'atom-1', position: 1 },
        ],
      });
    });
  });

  /** A key already taken inside the rule is the author's to fix, so it has to be said. */
  it('names the clash when the key is already in use', async () => {
    const { user } = renderPanel([]);
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if ((init?.method ?? 'GET') === 'GET') {
        return Promise.resolve(new Response('[]', { status: 200 }));
      }
      return Promise.resolve(new Response(JSON.stringify({ error: 'key_taken' }), { status: 409 }));
    });

    await user.click(await screen.findByRole('button', { name: /add an atom/i }));
    await user.type(screen.getByLabelText(/what the atom is/i), 'Gender');
    await user.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith(
        enMessages.Authoring.atoms.keyTaken as unknown as string,
      );
    });
  });
});

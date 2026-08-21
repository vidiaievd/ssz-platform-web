import { render, screen, fireEvent, act } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import type { Container } from '@/features/content/types';

vi.mock('../actions/grammar', () => ({
  updateGrammarRuleAction: vi.fn(),
  saveGrammarExplanationAction: vi.fn(),
}));
vi.mock('../api/use-authoring-grammar', () => ({
  useAuthoringGrammarExplanations: vi.fn(),
}));
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

const { GrammarEditorPane } = await import('./grammar-editor-pane');
const { updateGrammarRuleAction, saveGrammarExplanationAction } =
  await import('../actions/grammar');
const { useAuthoringGrammarExplanations } = await import('../api/use-authoring-grammar');

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

function renderPane() {
  const queryClient = new QueryClient();
  render(
    <QueryClientProvider client={queryClient}>
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <GrammarEditorPane
          kind="grammar"
          ruleId="rule-1"
          ruleTitle="Present tense"
          state="draft"
          isLive={false}
          container={CONTAINER}
          publishSlot={null}
        />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.mocked(updateGrammarRuleAction).mockReset();
  vi.mocked(updateGrammarRuleAction).mockResolvedValue({ ok: true, value: undefined } as never);
  vi.mocked(saveGrammarExplanationAction).mockReset();
  vi.mocked(saveGrammarExplanationAction).mockResolvedValue({
    ok: true,
    value: { explanationId: 'exp-1' },
  } as never);
  vi.mocked(useAuthoringGrammarExplanations).mockReturnValue({
    data: [
      {
        id: 'exp-1',
        languageCode: 'en',
        title: 'How to form the present tense',
        body: 'Add -er to the verb stem.',
        examples: ['Jeg spiser et eple.'],
      },
    ],
    isLoading: false,
  } as never);
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('GrammarEditorPane', () => {
  it('renders the loaded explanation and examples in both the editor and the live preview', () => {
    renderPane();
    expect(screen.getByDisplayValue('Add -er to the verb stem.')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Jeg spiser et eple.')).toBeInTheDocument();
    expect(screen.getByText('Jeg spiser et eple.')).toBeInTheDocument();
  });

  it('saves body edits when save is pressed', async () => {
    renderPane();

    fireEvent.change(screen.getByPlaceholderText('Write explanation in Markdown…'), {
      target: { value: 'New explanation text.' },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    });

    expect(saveGrammarExplanationAction).toHaveBeenCalledWith('rule-1', 'exp-1', 'module-1', 'A2', {
      languageCode: 'en',
      title: 'How to form the present tense',
      body: 'New explanation text.',
      examples: [{ text: 'Jeg spiser et eple.' }],
    });
    expect(updateGrammarRuleAction).toHaveBeenCalledWith('rule-1', 'module-1', {
      title: 'Present tense',
    });
  });
});

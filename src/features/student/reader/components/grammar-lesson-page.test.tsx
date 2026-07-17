import { render, screen, fireEvent } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import type { GrammarExplanationDetail, GrammarRule } from '@/features/content/types';
import type { StudentProfile } from '@/features/profile';

const useGrammarRule = vi.fn();
const useBestGrammarExplanation = vi.fn();
const useMyStudentProfile = vi.fn();

vi.mock('@/features/content', async () => {
  const actual = await vi.importActual<typeof import('@/features/content')>('@/features/content');
  return {
    ...actual,
    useGrammarRule: (...args: unknown[]) => useGrammarRule(...args),
    useBestGrammarExplanation: (...args: unknown[]) => useBestGrammarExplanation(...args),
  };
});
vi.mock('@/features/profile', () => ({ useMyStudentProfile: () => useMyStudentProfile() }));
vi.mock('@/lib/i18n/navigation', () => ({
  Link: ({
    href,
    children,
    ...props
  }: { href: string; children: React.ReactNode } & React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const { GrammarLessonPage } = await import('./grammar-lesson-page');

const RULE: GrammarRule = {
  id: 'rule-1',
  title: 'Inversjon',
  targetLanguage: 'nb',
  createdAt: '2026-01-01T00:00:00Z',
  containerItemId: 'ci-1',
};

const EXPLANATION: GrammarExplanationDetail = {
  id: 'exp-1',
  languageCode: 'en',
  title: 'Inversion',
  body: 'When a Norwegian sentence starts with a time or place expression, the verb comes before the subject.',
  isPublished: true,
  anchorText: 'Etter jobb liker jeg å slappe av hjemme.',
  anchorHighlights: ['Etter jobb', 'liker', 'jeg'],
  anchorNote: 'The time expression is fronted, so the verb comes before the subject.',
  compareExamples: [
    { id: 'c1', sentence: 'Jeg jobber om morgenen.', note: 'Normal order', isCorrect: true },
    { id: 'c2', sentence: 'Om morgenen jeg jobber.', note: 'No inversion — incorrect', isCorrect: false },
  ],
  quickCheck: {
    question: 'Which sentence uses correct Norwegian word order?',
    options: ['På jobben jeg har mange oppgaver.', 'På jobben har jeg mange oppgaver.'],
    correctOptionIndex: 1,
    explanation: '"På jobben" is fronted, so the verb must come before the subject.',
  },
};

const PROFILE: StudentProfile = {
  id: 'p1',
  userId: 'u1',
  nativeLanguage: 'en',
  targetLanguages: [{ code: 'nb', level: 'B1' }],
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

function mockHappyPath(overrides: Partial<GrammarExplanationDetail> = {}) {
  useGrammarRule.mockReturnValue({ isLoading: false, isError: false, data: RULE, refetch: vi.fn() });
  useMyStudentProfile.mockReturnValue({ isLoading: false, isError: false, data: PROFILE, refetch: vi.fn() });
  useBestGrammarExplanation.mockReturnValue({
    isLoading: false,
    isError: false,
    data: { ...EXPLANATION, ...overrides },
    refetch: vi.fn(),
  });
}

function renderPage(overrides: Partial<React.ComponentProps<typeof GrammarLessonPage>> = {}) {
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <GrammarLessonPage
        ruleId="rule-1"
        unitPosition={4}
        courseTitle="Norsk B1"
        cefrLevel="B1"
        {...overrides}
      />
    </NextIntlClientProvider>,
  );
}

describe('GrammarLessonPage', () => {
  it('shows a loading skeleton while fetching', () => {
    useGrammarRule.mockReturnValue({ isLoading: true, isError: false, data: undefined, refetch: vi.fn() });
    useMyStudentProfile.mockReturnValue({ isLoading: true, isError: false, data: undefined, refetch: vi.fn() });
    useBestGrammarExplanation.mockReturnValue({ isLoading: false, isError: false, data: undefined, refetch: vi.fn() });
    renderPage();
    expect(screen.getByRole('status', { name: /loading/i })).toBeInTheDocument();
  });

  it('shows an error state with retry on failure', () => {
    const refetchRule = vi.fn();
    useGrammarRule.mockReturnValue({ isLoading: false, isError: true, data: undefined, refetch: refetchRule });
    useMyStudentProfile.mockReturnValue({ isLoading: false, isError: false, data: PROFILE, refetch: vi.fn() });
    useBestGrammarExplanation.mockReturnValue({ isLoading: false, isError: false, data: undefined, refetch: vi.fn() });
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(refetchRule).toHaveBeenCalled();
  });

  it('shows an actionable empty state when the profile has no native language yet', () => {
    useGrammarRule.mockReturnValue({ isLoading: false, isError: false, data: RULE, refetch: vi.fn() });
    useMyStudentProfile.mockReturnValue({
      isLoading: false,
      isError: false,
      data: { ...PROFILE, nativeLanguage: null },
      refetch: vi.fn(),
    });
    useBestGrammarExplanation.mockReturnValue({ isLoading: false, isError: false, data: undefined, refetch: vi.fn() });
    renderPage();
    expect(screen.getByText("This lesson isn't ready for you yet")).toBeInTheDocument();
  });

  it('renders the concept, title, and highlighted anchor tokens', () => {
    mockHappyPath();
    renderPage();

    expect(screen.getByText('Inversion')).toBeInTheDocument();
    expect(
      screen.getByText(/When a Norwegian sentence starts with a time or place expression/),
    ).toBeInTheDocument();

    // Anchor highlights are wrapped in their own <span>, splitting the sentence.
    const highlighted = screen.getByText('liker');
    expect(highlighted.tagName).toBe('SPAN');
    expect(highlighted).not.toBe(screen.getByText(/The time expression is fronted/));
    expect(screen.getByText('jeg')).toBeInTheDocument();
    expect(screen.getByText(/The time expression is fronted/)).toBeInTheDocument();
  });

  it('omits the anchor block when anchorText is absent', () => {
    mockHappyPath({ anchorText: null });
    renderPage();
    expect(screen.queryByText('From the text')).not.toBeInTheDocument();
  });

  it('renders the compare list with correct/incorrect indicators', () => {
    mockHappyPath();
    renderPage();

    expect(screen.getByText('Compare')).toBeInTheDocument();
    expect(screen.getByText('Jeg jobber om morgenen.')).toBeInTheDocument();
    expect(screen.getByText('Normal order')).toBeInTheDocument();
    expect(screen.getByText('Om morgenen jeg jobber.')).toBeInTheDocument();
    expect(screen.getByText('No inversion — incorrect')).toBeInTheDocument();
  });

  it('omits the compare list when compareExamples is empty', () => {
    mockHappyPath({ compareExamples: [] });
    renderPage();
    expect(screen.queryByText('Compare')).not.toBeInTheDocument();
  });

  it('lets the learner pick a quick-check option and reveals correctness on check', () => {
    mockHappyPath();
    renderPage();

    expect(screen.getByText('Which sentence uses correct Norwegian word order?')).toBeInTheDocument();

    const wrongOption = screen.getByRole('radio', { name: /På jobben jeg har mange oppgaver\./ });
    fireEvent.click(wrongOption);
    expect(wrongOption).toHaveAttribute('aria-checked', 'true');

    const checkButton = screen.getByRole('button', { name: 'Check answer' });
    fireEvent.click(checkButton);

    // Wrong pick was made, so the result line should say "Not quite." and the
    // correct option (index 1) must still be revealed even though unselected.
    expect(screen.getByText('Not quite.')).toBeInTheDocument();
    expect(screen.getByText(/is fronted, so the verb must come before the subject/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Check answer' })).not.toBeInTheDocument();
  });

  it('shows the correct-answer feedback when the learner picks the right option', () => {
    mockHappyPath();
    renderPage();

    fireEvent.click(screen.getByRole('radio', { name: /På jobben har jeg mange oppgaver\./ }));
    fireEvent.click(screen.getByRole('button', { name: 'Check answer' }));

    expect(screen.getByText('Correct!')).toBeInTheDocument();
  });

  it('omits the quick-check card when quickCheck is null', () => {
    mockHappyPath({ quickCheck: null });
    renderPage();
    expect(screen.queryByText('Quick check')).not.toBeInTheDocument();
  });
});

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import { emptyContent, type ShortAnswerContent } from '@/lib/shared-kernel/short-answer';

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

const { StepReview } = await import('./step-review');
type ShortAnswerDocument = import('./edits').ShortAnswerDocument;

function doc(overrides: Partial<ShortAnswerContent> = {}): ShortAnswerDocument {
  const content = emptyContent();
  const question = content.questions[0]!;

  return {
    updatedAt: '2026-08-23T10:00:00.000Z',
    ...content,
    questions: [
      {
        ...question,
        id: 'q1',
        prompt: 'Hva er nytt fra 1. januar?',
        model: 'Alle syklister må ha lys foran og bak.',
        why: 'Teksten sier hva regelen krever.',
        elements: [
          { id: 'e1', label: 'kravet', anchors: ['lys foran', 'foran og bak'], required: true },
        ],
      },
    ],
    ...overrides,
  };
}

function renderStep(exercise: ShortAnswerDocument = doc()) {
  const onChange = vi.fn();
  render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <StepReview exercise={exercise} containerId="module-1" onChange={onChange} />
    </NextIntlClientProvider>,
  );
  return { onChange, user: userEvent.setup() };
}

describe('StepReview', () => {
  it('draws all three stages, counting the phrases the first one runs on', () => {
    renderStep();

    expect(screen.getByText('Phrase match')).toBeInTheDocument();
    expect(screen.getByText(/2 phrases from step 2/)).toBeInTheDocument();
    expect(screen.getByText('AI check')).toBeInTheDocument();
    expect(screen.getByText('Teacher')).toBeInTheDocument();
  });

  it('tags the AI stage as off and says nothing calls a model', () => {
    renderStep();

    expect(screen.getByText('off')).toBeInTheDocument();
    expect(screen.getByText(/Nothing calls a model in this build/)).toBeInTheDocument();
  });

  it('keeps the grammar switch away while the stage is off', () => {
    renderStep();

    expect(
      screen.queryByRole('switch', { name: /AI comments on grammar too/ }),
    ).not.toBeInTheDocument();
  });

  it('shows the grammar switch, and tags the stage a preview, once it is on', () => {
    renderStep(doc({ settings: { ...doc().settings, aiStage: true } }));

    expect(screen.getByText('preview')).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: /AI comments on grammar too/ })).toBeInTheDocument();
  });

  it('stores the AI switch without anything reading it', async () => {
    const { onChange, user } = renderStep();

    await user.click(screen.getByRole('switch', { name: /AI check before the teacher/ }));

    expect((onChange.mock.calls.at(-1)![0] as ShortAnswerDocument).settings.aiStage).toBe(true);
  });

  it('reads the teacher stage from the routing policy', () => {
    renderStep(doc({ settings: { ...doc().settings, teacherReview: 'all' } }));

    expect(screen.getByText('Every answer lands in your queue.')).toBeInTheDocument();
  });

  it('warns on the step when nobody is left to read the answers', () => {
    renderStep(doc({ settings: { ...doc().settings, teacherReview: 'none' } }));

    expect(screen.getByText(/Nobody ever reads these answers/)).toBeInTheDocument();
    expect(
      screen.getByText('Nothing is sent on. The phrase match has the last word.'),
    ).toBeInTheDocument();
  });

  it('changes the routing policy', async () => {
    const { onChange, user } = renderStep();

    await user.click(screen.getByRole('radio', { name: 'Every answer' }));

    expect((onChange.mock.calls.at(-1)![0] as ShortAnswerDocument).settings.teacherReview).toBe(
      'all',
    );
  });

  it('links into the one queue the platform has, filtered to this course and type', () => {
    renderStep();

    expect(screen.getByRole('link', { name: /Open the marking queue/ })).toHaveAttribute(
      'href',
      '/school/demo-school/review?course=module-1&type=short_answer',
    );
  });
});

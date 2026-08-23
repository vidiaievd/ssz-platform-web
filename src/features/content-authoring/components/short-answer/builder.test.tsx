import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import { emptyContent, type ShortAnswerContent } from '@/lib/shared-kernel/short-answer';

import type { ShortAnswerDocument } from './edits';

vi.mock('../../actions/short-answer', () => ({ saveShortAnswerAction: vi.fn() }));

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

const { ShortAnswerBuilder } = await import('./builder');
const { saveShortAnswerAction } = await import('../../actions/short-answer');

const LOADED_AT = '2026-08-23T10:00:00.000Z';

/**
 * A document with nothing left to fix, so a test can add exactly one problem.
 *
 * The model answer contains the element's only anchor on purpose: that is what
 * `modelPasses` asks, and it is the difference between a clean rail and a step-2 blocker.
 */
function doc(overrides: Partial<ShortAnswerContent> = {}): ShortAnswerDocument {
  const content = emptyContent();
  const question = content.questions[0]!;

  return {
    updatedAt: LOADED_AT,
    ...content,
    questions: [
      {
        ...question,
        kind: 'reading',
        passage: 'Fra 1. januar må alle syklister ha lys foran og bak.',
        prompt: 'Hva er nytt fra 1. januar?',
        model: 'Alle syklister må ha lys foran og bak i mørket.',
        why: 'Teksten sier hva regelen krever.',
        elements: [
          {
            ...question.elements[0]!,
            label: 'kravet',
            anchors: ['lys foran', 'foran og bak'],
            required: true,
          },
        ],
      },
    ],
    ...overrides,
  };
}

function renderBuilder(exercise: ShortAnswerDocument = doc()) {
  render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <ShortAnswerBuilder exerciseId="ex-1" containerId="module-1" initialExercise={exercise} />
    </NextIntlClientProvider>,
  );
  return { user: userEvent.setup() };
}

/** The gate, from where an author reaches it: the last step's own way forward. */
async function openGate(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('tab', { name: /Review/ }));
  await user.click(screen.getByRole('button', { name: /Review & finish/ }));
}

beforeEach(() => {
  vi.mocked(saveShortAnswerAction).mockResolvedValue({
    ok: true,
    value: { status: 'saved', updatedAt: '2026-08-23T10:00:05.000Z' },
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('ShortAnswerBuilder', () => {
  it('opens on a clean rail when the document has nothing left to fix', () => {
    renderBuilder();

    expect(screen.getByRole('tab', { name: /Questions/ })).toHaveAttribute('aria-selected', 'true');
    for (const step of ['Questions', 'Answer key', 'Verdict', 'Review']) {
      expect(
        within(screen.getByRole('tab', { name: new RegExp(step) })).getByText('ready'),
      ).toBeInTheDocument();
    }
  });

  it('marks the step that holds a blocker, and reaches it in one click', async () => {
    // No explanation to show under the verdict: step 3.
    const { user } = renderBuilder(
      doc({ questions: doc().questions.map((q) => ({ ...q, why: '' })) }),
    );

    const verdict = screen.getByRole('tab', { name: /Verdict/ });
    expect(within(verdict).getByText('1 problem')).toBeInTheDocument();

    await user.click(verdict);
    expect(verdict).toHaveAttribute('aria-selected', 'true');
  });

  it('reports the model answer failing its own key as a blocker, not a warning', async () => {
    // The anchors no longer appear in the author's own answer — plan 51 §4, rule 3.
    const broken = doc().questions.map((q) => ({
      ...q,
      elements: q.elements.map((e) => ({ ...e, anchors: ['refleksvest'] })),
    }));
    const { user } = renderBuilder(doc({ questions: broken }));

    expect(
      within(screen.getByRole('tab', { name: /Answer key/ })).getByText('1 problem'),
    ).toBeInTheDocument();

    await openGate(user);

    const dialog = screen.getByRole('dialog');
    expect(
      within(dialog).getByText(/Question 1: your own model answer covers 0 of 1 elements/),
    ).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: /Fix 1 problem first/ })).toBeDisabled();
  });

  it('names the question a problem belongs to, not its id', async () => {
    const questions = [...doc().questions, { ...doc().questions[0]!, id: 'q2', prompt: '' }];
    const { user } = renderBuilder(doc({ questions }));

    await openGate(user);

    expect(
      within(screen.getByRole('dialog')).getByText('Question 2: the question needs text.'),
    ).toBeInTheDocument();
  });

  it('links a gate row to the step that owns it', async () => {
    const { user } = renderBuilder(
      doc({ questions: doc().questions.map((q) => ({ ...q, prompt: '' })) }),
    );

    await openGate(user);

    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: /the question needs text/ }),
    );
    expect(screen.getByRole('tab', { name: /Questions/ })).toHaveAttribute('aria-selected', 'true');
  });

  it('leaves an info-level remark out of the gate — there is nothing to fix', async () => {
    // A single anchor is worth saying next to the element; it is not a reason to hold the
    // exercise back, and a green gate that listed it would look like a red one.
    const single = doc().questions.map((q) => ({
      ...q,
      elements: q.elements.map((e) => ({ ...e, anchors: ['lys foran'] })),
    }));
    const { user } = renderBuilder(doc({ questions: single }));

    const dialog = (await openGate(user), screen.getByRole('dialog'));
    expect(within(dialog).queryByText(/word it differently/)).not.toBeInTheDocument();
    expect(within(dialog).getByText(/ready to assign/)).toBeInTheDocument();
  });

  it('summarises what the exercise will do, not only what is wrong with it', async () => {
    const { user } = renderBuilder();

    await openGate(user);

    const dialog = screen.getByRole('dialog');
    expect(
      within(dialog).getByText('1 question ready to answer, 2 phrases in the key.'),
    ).toBeInTheDocument();
    // The one claim in this builder that is a result rather than a setting.
    expect(within(dialog).getByText('Every model answer passes its own key.')).toBeInTheDocument();
    expect(within(dialog).getByText('A pass needs every required element.')).toBeInTheDocument();
    expect(within(dialog).getByText('Partial and failed answers reach you.')).toBeInTheDocument();
    expect(within(dialog).getByText('AI stage off.')).toBeInTheDocument();
  });

  it('does not claim the models pass when one of them does not', async () => {
    const broken = doc().questions.map((q) => ({
      ...q,
      elements: q.elements.map((e) => ({ ...e, anchors: ['refleksvest'] })),
    }));
    const { user } = renderBuilder(doc({ questions: broken }));

    await openGate(user);

    expect(
      within(screen.getByRole('dialog')).queryByText('Every model answer passes its own key.'),
    ).not.toBeInTheDocument();
  });

  it('warns, without blocking, when nobody is left to read the answers', async () => {
    const { user } = renderBuilder(doc({ settings: { ...doc().settings, teacherReview: 'none' } }));

    await openGate(user);

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText(/Nobody ever reads these answers/)).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: /Looks good/ })).toBeEnabled();
  });
});

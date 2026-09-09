import { useState } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import { emptyContent, type WritingTask } from '@/lib/shared-kernel/writing-task';

const schoolSlug = vi.hoisted(() => ({ current: 'demo-school' as string | undefined }));
vi.mock('next/navigation', () => ({ useParams: () => ({ schoolSlug: schoolSlug.current }) }));
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

const { StepFlow } = await import('./step-flow');

function doc(overrides: Partial<WritingTask> = {}): WritingTask {
  const content = emptyContent();
  return {
    id: 'ex-1',
    type: 'writing_task',
    moduleId: 'module-1',
    title: '',
    updatedAt: '2026-08-22T10:00:00.000Z',
    ...content,
    prompt: 'Du har nettopp flyttet til en ny by.',
    ...overrides,
  };
}

function Harness({
  initial,
  onChange,
}: {
  initial: WritingTask;
  onChange?: (next: WritingTask) => void;
}) {
  const [exercise, setExercise] = useState(initial);
  return (
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <StepFlow
        exercise={exercise}
        containerId="course-7"
        onChange={(next) => {
          onChange?.(next);
          setExercise(next);
        }}
      />
    </NextIntlClientProvider>
  );
}

function renderStep(initial: WritingTask = doc(), onChange?: (next: WritingTask) => void) {
  render(<Harness initial={initial} onChange={onChange} />);
  return { user: userEvent.setup() };
}

describe('the pipeline', () => {
  it('says the teacher stage cannot be switched off', () => {
    renderStep();

    expect(screen.getByText(/Cannot be switched off for free text./)).toBeInTheDocument();
  });

  it('describes the writing stage from the conditions actually set', () => {
    renderStep(doc({ settings: { ...doc().settings, timer: 40, blockPaste: false } }));

    expect(screen.getByText('Draft, length requirement, time')).toBeInTheDocument();
  });

  // Nothing calls a model in this build (plan 50 §3.5); the diagram has to say so.
  it('tags the AI stage a preview when on and off when off', async () => {
    const { user } = renderStep();

    expect(screen.getByText('preview')).toBeInTheDocument();

    await user.click(screen.getByRole('switch', { name: /AI pre-check/ }));

    expect(screen.getByText('off')).toBeInTheDocument();
    expect(screen.queryByText('preview')).not.toBeInTheDocument();
  });

  it('counts the checks that are on and names their audience', () => {
    renderStep(
      doc({
        settings: {
          ...doc().settings,
          aiVisibility: 'teacher',
          ai: { ...doc().settings.ai, lexis: false },
        },
      }),
    );

    expect(screen.getByText('4 of 5 checks on · only the teacher sees it.')).toBeInTheDocument();
  });
});

describe('the AI stage', () => {
  it('hides its settings entirely when the stage is off', async () => {
    const { user } = renderStep();

    expect(screen.getByText('What the AI looks at')).toBeInTheDocument();

    await user.click(screen.getByRole('switch', { name: /AI pre-check/ }));

    expect(screen.queryByText('What the AI looks at')).not.toBeInTheDocument();
  });

  it('turns one check off without touching the rest', async () => {
    const onChange = vi.fn();
    const { user } = renderStep(doc(), onChange);

    await user.click(screen.getByRole('checkbox', { name: /Grammar and spelling/ }));

    const next = onChange.mock.calls.at(-1)![0] as WritingTask;
    expect(next.settings.ai).toEqual({ ...doc().settings.ai, grammar: false });
  });

  it('asks for a self-check limit only where the student can run it', async () => {
    const { user } = renderStep(doc({ settings: { ...doc().settings, aiVisibility: 'teacher' } }));

    expect(screen.queryByText('Self-checks allowed')).not.toBeInTheDocument();

    const who = screen.getByRole('radiogroup', { name: 'Who sees the result' });
    await user.click(within(who).getByRole('radio', { name: 'Student, before' }));

    expect(screen.getByText('Self-checks allowed')).toBeInTheDocument();
  });

  it('warns when the student can run it as often as they like', () => {
    renderStep(
      doc({ settings: { ...doc().settings, aiVisibility: 'studentBefore', aiSelfLimit: 0 } }),
    );

    expect(screen.getByText(/becomes a conversation with the model/)).toHaveClass(
      'text-warning-700',
    );
  });

  // `AI_STAGE_OFF_DRAFT_ON` is info-level: it never reaches the gate, so this is the
  // only place it is ever said.
  it('mentions a pre-filled rubric with no stage to fill it, inline', async () => {
    const { user } = renderStep();

    expect(screen.queryByText(/nothing pre-fills anything/)).not.toBeInTheDocument();

    await user.click(screen.getByRole('switch', { name: /AI pre-check/ }));

    expect(screen.getByText(/nothing pre-fills anything/)).toBeInTheDocument();
  });
});

describe('the queue link', () => {
  it('opens the one queue the platform has, narrowed to this course and template', () => {
    renderStep();

    expect(screen.getByRole('link', { name: /Open the marking queue/ })).toHaveAttribute(
      'href',
      '/school/demo-school/review?course=course-7&type=writing_task',
    );
  });

  it('says nothing at all outside a school route, where there is nowhere to link', () => {
    schoolSlug.current = undefined;
    try {
      renderStep();
      expect(
        screen.queryByRole('link', { name: /Open the marking queue/ }),
      ).not.toBeInTheDocument();
    } finally {
      schoolSlug.current = 'demo-school';
    }
  });
});

describe('rewrites', () => {
  it('is the one setting that decides whether marking teaches anything', async () => {
    const onChange = vi.fn();
    const { user } = renderStep(doc(), onChange);

    const control = screen.getByRole('radiogroup', { name: "After the teacher's verdict" });
    await user.click(within(control).getByRole('radio', { name: 'One submission' }));

    expect((onChange.mock.calls.at(-1)![0] as WritingTask).settings.revision).toBe('once');
  });
});

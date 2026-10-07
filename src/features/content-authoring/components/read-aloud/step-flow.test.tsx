import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { describe, expect, it, vi } from 'vitest';

import type { ReadAloudDocument } from './edits';
import { Harness, PAGE_RULES, sampleReadAloud } from './test-support';

const workspaceId = vi.hoisted(() => ({ current: 'demo-school' as string | undefined }));
vi.mock('next/navigation', () => ({ useParams: () => ({ workspaceId: workspaceId.current }) }));
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

function renderStep(initial: ReadAloudDocument, onChange?: (next: ReadAloudDocument) => void) {
  const view = render(
    <Harness
      initial={initial}
      step={(props) => <StepFlow {...props} containerId="course-7" />}
      onChange={onChange}
    />,
  );
  return { user: userEvent.setup(), ...view };
}

describe('StepFlow — the pipeline (RA-B13)', () => {
  it('draws recording, the AI check and the teacher, and says the teacher cannot be switched off', () => {
    renderStep(sampleReadAloud());
    const pipe = screen.getByRole('region', { name: 'What happens to a recording' });
    expect(within(pipe).getByText('Opptak')).toBeInTheDocument();
    expect(within(pipe).getByText('AI-forsjekk')).toBeInTheDocument();
    expect(within(pipe).getByText('Lærer')).toBeInTheDocument();
    expect(within(pipe).getByText(/Cannot be switched off/)).toBeInTheDocument();
    expect(within(pipe).getByText('off · plan 48')).toBeInTheDocument();
  });

  it('calls the AI stage a preview when it is on, and offers its three outputs and audience', async () => {
    const seen: ReadAloudDocument[] = [];
    const { user } = renderStep(sampleReadAloud(), (d) => seen.push(d));
    expect(screen.queryByText('Automatic transcript')).not.toBeInTheDocument();
    await user.click(screen.getByRole('switch', { name: /AI pre-check/ }));
    expect(screen.getByText('preview · plan 48')).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: /Automatic transcript/ })).toBeChecked();
    expect(screen.getByRole('switch', { name: /Pronunciation hint/ })).toBeChecked();
    expect(screen.getByRole('switch', { name: /Draft rubric/ })).not.toBeChecked();
    await user.click(screen.getByRole('radio', { name: 'Student, after grading' }));
    expect(seen.at(-1)?.review.aiVisibility).toBe('studentAfter');
    expect(seen.at(-1)?.review.aiStage).toBe(true);
  });

  it('keeps an output the author switched off while the stage is off and on again', async () => {
    const { user } = renderStep(sampleReadAloud());
    await user.click(screen.getByRole('switch', { name: /AI pre-check/ }));
    await user.click(screen.getByRole('switch', { name: /Automatic transcript/ }));
    await user.click(screen.getByRole('switch', { name: /AI pre-check/ }));
    await user.click(screen.getByRole('switch', { name: /AI pre-check/ }));
    expect(screen.getByRole('switch', { name: /Automatic transcript/ })).not.toBeChecked();
  });
});

describe('StepFlow — after a weak recording (RA-B14)', () => {
  it('chooses between one submission and being sent back', async () => {
    const seen: ReadAloudDocument[] = [];
    const { user } = renderStep(sampleReadAloud(), (d) => seen.push(d));
    const group = screen.getByRole('radiogroup', { name: 'After a weak recording' });
    expect(within(group).getByRole('radio', { name: 'Can be sent back' })).toBeChecked();
    await user.click(within(group).getByRole('radio', { name: 'One submission' }));
    expect(seen.at(-1)?.settings.revision).toBe('once');
  });
});

describe('StepFlow — the queue link (RA-B14)', () => {
  it('opens the one queue the platform has, narrowed to this course and this type', () => {
    renderStep(sampleReadAloud());
    expect(screen.getByRole('link', { name: 'Open the review queue' })).toHaveAttribute(
      'href',
      '/w/demo-school/review?course=course-7&type=read_aloud',
    );
  });

  it('is absent outside a workspace route, where there is nowhere to link', () => {
    workspaceId.current = undefined;
    try {
      renderStep(sampleReadAloud());
      expect(screen.queryByRole('link', { name: 'Open the review queue' })).not.toBeInTheDocument();
    } finally {
      workspaceId.current = 'demo-school';
    }
  });
});

describe('StepFlow — a11y', () => {
  it('has no axe violations', async () => {
    const { container, user } = renderStep(sampleReadAloud());
    expect((await axe.run(container, PAGE_RULES)).violations).toEqual([]);
    await user.click(screen.getByRole('switch', { name: /AI pre-check/ }));
    expect((await axe.run(container, PAGE_RULES)).violations).toEqual([]);
  });
});

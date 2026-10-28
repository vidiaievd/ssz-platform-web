import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { describe, expect, it, vi } from 'vitest';

import { setMode, setReview, type ReadAloudDocument } from './edits';
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

describe('StepFlow — the pipeline (RA-B13, plan 82)', () => {
  it('draws recording, the machine check and the teacher, with the teacher in a school', () => {
    renderStep(sampleReadAloud());
    const pipe = screen.getByRole('region', { name: 'What happens to a recording' });
    expect(within(pipe).getByText('Opptak')).toBeInTheDocument();
    expect(within(pipe).getByText('AI-forsjekk')).toBeInTheDocument();
    expect(within(pipe).getByText('Lærer')).toBeInTheDocument();
    expect(within(pipe).getByText('in a school')).toBeInTheDocument();
    expect(within(pipe).getByText('off')).toBeInTheDocument();
    expect(screen.queryByText(/not live|calls nothing|plan 48/)).not.toBeInTheDocument();
  });

  it('turns the machine on with its check, threshold, pronunciation and pace', async () => {
    const seen: ReadAloudDocument[] = [];
    const { user } = renderStep(sampleReadAloud(), (d) => seen.push(d));
    expect(screen.queryByText('Check against the text')).not.toBeInTheDocument();
    await user.click(screen.getByRole('switch', { name: /Machine reading check/ }));
    expect(screen.getByText('on')).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: /Check against the text/ })).toBeChecked();
    expect(screen.getByRole('spinbutton', { name: 'Words to pass a prompt' })).toHaveValue(85);
    expect(screen.getByRole('switch', { name: /Pronunciation feedback/ })).toBeChecked();
    await user.click(screen.getByRole('switch', { name: /Pace/ }));
    expect(seen.at(-1)?.review.ai.fluency).toBe(true);
    expect(seen.at(-1)?.review.aiStage).toBe(true);
  });

  it('offers neither the rubric draft nor the audience, which nothing reads for this type', async () => {
    const { user } = renderStep(sampleReadAloud());
    await user.click(screen.getByRole('switch', { name: /Machine reading check/ }));
    expect(screen.queryByRole('switch', { name: /Draft rubric/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('radiogroup', { name: /Who sees/ })).not.toBeInTheDocument();
  });

  it('calls the stage off when the check against the text is off, and hides the threshold', async () => {
    const { user } = renderStep(sampleReadAloud());
    await user.click(screen.getByRole('switch', { name: /Machine reading check/ }));
    await user.click(screen.getByRole('switch', { name: /Check against the text/ }));
    expect(screen.getByText('off')).toBeInTheDocument();
    expect(
      screen.queryByRole('spinbutton', { name: 'Words to pass a prompt' }),
    ).not.toBeInTheDocument();
  });

  it('keeps an output the author switched off while the stage is off and on again', async () => {
    const { user } = renderStep(sampleReadAloud());
    await user.click(screen.getByRole('switch', { name: /Machine reading check/ }));
    await user.click(screen.getByRole('switch', { name: /Check against the text/ }));
    await user.click(screen.getByRole('switch', { name: /Machine reading check/ }));
    await user.click(screen.getByRole('switch', { name: /Machine reading check/ }));
    expect(screen.getByRole('switch', { name: /Check against the text/ })).not.toBeChecked();
  });
});

describe('StepFlow — the threshold (plan 82, Q4)', () => {
  const on = () => setReview(sampleReadAloud(), { aiStage: true });

  it('saves a value in range as it is typed', async () => {
    const seen: ReadAloudDocument[] = [];
    const { user } = renderStep(on(), (d) => seen.push(d));
    const field = screen.getByRole('spinbutton', { name: 'Words to pass a prompt' });
    await user.clear(field);
    await user.type(field, '90');
    expect(seen.at(-1)?.review.readingPassPercent).toBe(90);
    expect(seen.map((d) => d.review.readingPassPercent)).not.toContain(9);
  });

  it('clamps what is left out of range when the field is left', async () => {
    const seen: ReadAloudDocument[] = [];
    const { user } = renderStep(on(), (d) => seen.push(d));
    const field = screen.getByRole('spinbutton', { name: 'Words to pass a prompt' });
    await user.clear(field);
    await user.type(field, '30');
    await user.tab();
    expect(seen.at(-1)?.review.readingPassPercent).toBe(50);
    expect(field).toHaveValue(50);
  });

  it('shows the value again when the field is emptied and left', async () => {
    const seen: ReadAloudDocument[] = [];
    const { user } = renderStep(on(), (d) => seen.push(d));
    const field = screen.getByRole('spinbutton', { name: 'Words to pass a prompt' });
    await user.clear(field);
    await user.tab();
    expect(seen).toHaveLength(0);
    expect(field).toHaveValue(85);
  });
});

describe('StepFlow — outside `read` (plan 82, Q7)', () => {
  it('says why the machine is off and does not let it be switched on', () => {
    renderStep(setMode(sampleReadAloud(), 'monologue'));
    const toggle = screen.getByRole('switch', { name: /Machine reading check/ });
    expect(toggle).toBeDisabled();
    expect(screen.getByText(/Only in «Read aloud» mode/)).toBeInTheDocument();
  });

  it('lets a switch left on from `read` be turned off, without its outputs', async () => {
    const seen: ReadAloudDocument[] = [];
    const { user } = renderStep(
      setMode(setReview(sampleReadAloud(), { aiStage: true }), 'monologue'),
      (d) => seen.push(d),
    );
    expect(
      screen.queryByRole('switch', { name: /Check against the text/ }),
    ).not.toBeInTheDocument();
    expect(screen.getByText('off')).toBeInTheDocument();
    await user.click(screen.getByRole('switch', { name: /Machine reading check/ }));
    expect(seen.at(-1)?.review.aiStage).toBe(false);
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
    await user.click(screen.getByRole('switch', { name: /Machine reading check/ }));
    expect((await axe.run(container, PAGE_RULES)).violations).toEqual([]);
  });
});

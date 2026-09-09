import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import { emptyContent, type WritingTask } from '@/lib/shared-kernel/writing-task';

vi.mock('@/features/media', () => ({ useMediaAsset: () => ({ data: undefined }) }));

import { WritingTaskPreview } from './writing-task-preview';

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
    model: 'Hei Anna! Jeg har flyttet til Bergen og trives godt.',
    points: content.points.map((point) => ({
      ...point,
      text: 'Fortell hvor du bor nå',
      keywords: ['flyttet til Bergen'],
    })),
    ...overrides,
  };
}

function renderPreview(exercise: WritingTask) {
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <WritingTaskPreview exercise={exercise} />
    </NextIntlClientProvider>,
  );
}

describe('WritingTaskPreview', () => {
  it('waits for a prompt before drawing a student screen', () => {
    renderPreview(doc({ prompt: '' }));

    expect(screen.getByText(/Write the task in step 1/)).toBeInTheDocument();
  });

  it('shows the task the student would get', () => {
    renderPreview(doc());

    expect(screen.getByText('Du har nettopp flyttet til en ny by.')).toBeInTheDocument();
    expect(screen.getByText('Fortell hvor du bor nå')).toBeInTheDocument();
  });

  it('never renders the answer key — the preview goes through the projection', () => {
    const { container } = renderPreview(doc());

    // The model answer, the point keywords and, by default, the level descriptors are
    // all `expected_answers`. A preview built from the document rather than the
    // projection would print every one of them onto the author's screen as if the
    // student saw them.
    expect(container.textContent).not.toContain('trives godt');
    expect(container.textContent).not.toContain('flyttet til Bergen');
    expect(container.textContent).not.toContain('Alle punktene er dekket og utdypet');
    expect(screen.queryByText(/Oppgaveløsning/)).not.toBeInTheDocument();
  });

  it('shows the level descriptors when the author chose to show them while writing', () => {
    // Plan 50 §5: `showRubric: 'always'` is the one case where the key crosses over, and
    // it is why the projection takes both columns. Only this panel can tell an author
    // that the setting three steps away actually reached the student's screen.
    renderPreview(doc({ settings: { ...doc().settings, showRubric: 'always' } }));

    expect(screen.getByText(/Alle punktene er dekket og utdypet/)).toBeInTheDocument();
  });
});

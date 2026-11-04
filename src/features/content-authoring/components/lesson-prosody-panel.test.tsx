import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { emptyProsodyLayer } from '@/lib/shared-kernel/prosody';

import type { PromptProsodyAuthoring } from '../actions/prosody';
import { Intl, PAGE_RULES } from './read-aloud/test-support';

vi.mock('../actions/prosody', () => ({
  loadLessonProsodyAction: vi.fn(),
  saveLessonProsodyAction: vi.fn(),
  suggestLessonProsodyAction: vi.fn(),
}));

const { LessonProsodyPanel } = await import('./lesson-prosody-panel');
const { loadLessonProsodyAction, saveLessonProsodyAction } = await import('../actions/prosody');

/** A hero image on a line of its own, a heading and two sentences. */
const BODY = '![Bergen](media://hero-1)\n\n## Søvn\n\nKari sover godt. Hun står opp tidlig.';

function viewOf(text = BODY): PromptProsodyAuthoring {
  return {
    text,
    notation: text,
    dropped: 0,
    layer: emptyProsodyLayer(),
    issues: [],
    updatedAt: null,
    lexicon: { stresses: [], sounds: [], unresolved: [{ i: 5, w: 'Kari' }] },
  };
}

function renderPanel(props: Partial<Parameters<typeof LessonProsodyPanel>[0]> = {}) {
  const view = render(
    <Intl>
      <LessonProsodyPanel
        lessonId="lesson-1"
        variantId="variant-1"
        savedBody={BODY}
        body={BODY}
        lang="nb"
        {...props}
      />
    </Intl>,
  );
  return { ...view, user: userEvent.setup() };
}

beforeEach(() => {
  vi.mocked(loadLessonProsodyAction).mockReset();
  vi.mocked(saveLessonProsodyAction).mockReset();
  vi.mocked(loadLessonProsodyAction).mockResolvedValue({
    ok: true,
    value: { status: 'loaded', view: viewOf() },
  });
});

describe('LessonProsodyPanel (plan 86, step 6h.4)', () => {
  it('reads nothing until the author opens it', async () => {
    const { user } = renderPanel();
    expect(loadLessonProsodyAction).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: /Mark/ }));
    expect(loadLessonProsodyAction).toHaveBeenCalledWith('lesson-1', 'variant-1');
    expect(await screen.findByText(/Not in the dictionary.*Kari/)).toBeInTheDocument();
  });

  it('offers the heading and the sentences, not the line of the hero image', async () => {
    const { user } = renderPanel();
    await user.click(screen.getByRole('button', { name: /Mark/ }));
    const list = await screen.findByRole('list', { name: 'Sentences of the passage' });
    const rows = within(list).getAllByRole('button');
    expect(rows.map((row) => row.textContent)).toEqual([
      expect.stringContaining('Søvn'),
      expect.stringContaining('Kari sover godt'),
      expect.stringContaining('Hun står opp tidlig'),
    ]);
    expect(within(list).queryByText(/media/)).not.toBeInTheDocument();
  });

  it('waits for the text to be saved while the field holds unsaved changes', async () => {
    const { user } = renderPanel({ body: `${BODY} Ny setning.` });
    await user.click(screen.getByRole('button', { name: /Mark/ }));
    expect(screen.getByText(/unsaved changes/)).toBeInTheDocument();
    expect(
      screen.queryByRole('list', { name: 'Sentences of the passage' }),
    ).not.toBeInTheDocument();
  });

  it('asks for a saved text before the first save of the lesson', async () => {
    const { user } = renderPanel({ variantId: undefined, savedBody: '', body: 'Hei' });
    await user.click(screen.getByRole('button', { name: /Mark/ }));
    expect(screen.getByText(/save the text first/)).toBeInTheDocument();
    expect(loadLessonProsodyAction).not.toHaveBeenCalled();
  });

  it('saves a pause on the lesson variant with the time it read', async () => {
    vi.mocked(saveLessonProsodyAction).mockResolvedValue({
      ok: true,
      value: { status: 'saved', view: { ...viewOf(), updatedAt: '2026-11-04T10:00:00.000Z' } },
    });
    const { user } = renderPanel();
    await user.click(screen.getByRole('button', { name: /Mark/ }));
    await user.click(await screen.findByRole('button', { name: /Kari sover godt/ }));
    await user.click(screen.getByRole('button', { name: 'Pause after «Kari»' }));
    await waitFor(() => expect(saveLessonProsodyAction).toHaveBeenCalledTimes(1), {
      timeout: 2000,
    });
    const [lessonId, variantId, input] = vi.mocked(saveLessonProsodyAction).mock.calls[0]!;
    expect([lessonId, variantId]).toEqual(['lesson-1', 'variant-1']);
    expect(input.expectedUpdatedAt).toBeNull();
    expect(input.layer.boundaries).toEqual([
      expect.objectContaining({ w: 'Kari', pause: 'short', source: 'teacher' }),
    ]);
    expect(await screen.findByText('Marks saved')).toBeInTheDocument();
  });

  it('has no axe violations when open', async () => {
    const { user, container } = renderPanel();
    await user.click(screen.getByRole('button', { name: /Mark/ }));
    await screen.findByRole('list', { name: 'Sentences of the passage' });
    const result = await axe.run(container, PAGE_RULES);
    expect(result.violations).toEqual([]);
  });
});

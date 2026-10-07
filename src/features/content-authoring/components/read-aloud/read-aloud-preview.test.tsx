import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createMockRecorder, type MockRecorder } from '@/features/student/exercises/recorder';
import { sampleDocument } from '@/lib/shared-kernel/read-aloud';

import type { ReadAloudDocument } from './edits';
import { ReadAloudPreview } from './read-aloud-preview';
import { documentOf, Intl, PAGE_RULES } from './test-support';

vi.mock('@/features/media', () => ({
  useMediaAsset: () => ({ data: undefined, isLoading: false }),
}));

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

/** One prompt, quick to record: no check, no countdown, no preparation, a 2 s minimum. */
function quick(): ReadAloudDocument {
  const base = sampleDocument();
  return documentOf({
    ...base,
    recording: { ...base.recording, micCheck: false, countdown: false },
    prompts: [{ ...base.prompts[0]!, prepSeconds: 0, minSeconds: 2 }],
  });
}

let port: MockRecorder;

function renderPreview(exercise = quick()) {
  const view = render(
    <Intl>
      <ReadAloudPreview exercise={exercise} createPort={() => port} />
    </Intl>,
  );
  return { user: userEvent.setup(), ...view };
}

beforeEach(() => {
  port = createMockRecorder();
  vi.stubGlobal(
    'URL',
    Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:take'), revokeObjectURL: vi.fn() }),
  );
});
afterEach(() => vi.unstubAllGlobals());

describe('ReadAloudPreview — static (RA-B17)', () => {
  it('draws the runner’s own body with nothing accepting input and no microphone', async () => {
    renderPreview();
    expect(screen.getByText('Jeg søkte', { exact: false })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start recording' })).toBeDisabled();
    expect(screen.getByText(/Static preview/)).toBeInTheDocument();
    await flush();
    expect(port.calls.open).toBe(0);
  });

  it('never shows the listening note or a focus word’s note to the student', () => {
    renderPreview();
    expect(screen.queryByText(/Lytt etter kj\/sj/)).not.toBeInTheDocument();
    expect(screen.queryByText(/kj-lyd etter s/)).not.toBeInTheDocument();
  });

  it('says there is nothing to preview when there is no prompt', () => {
    const base = quick();
    renderPreview({ ...base, prompts: [] });
    expect(screen.getByText(/Nothing to preview yet/)).toBeInTheDocument();
  });
});

describe('ReadAloudPreview — devices (RA-B17)', () => {
  it('switches to the reader’s card, whose Start goes back to the phone', async () => {
    const { user } = renderPreview();
    await user.click(screen.getByRole('radio', { name: 'Reader card' }));
    expect(screen.getByRole('region', { name: 'Les høyt — jobbsøknad' })).toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: 'Live' }));
    await user.click(screen.getByRole('button', { name: 'Start' }));
    expect(screen.getByRole('radio', { name: 'Phone' })).toBeChecked();
  });

  it('lays the same body out on the desktop', async () => {
    const { user } = renderPreview();
    await user.click(screen.getByRole('radio', { name: 'Desktop' }));
    expect(screen.getByRole('radio', { name: 'Desktop' })).toBeChecked();
    expect(screen.getByText('Jeg søkte', { exact: false })).toBeInTheDocument();
  });
});

describe('ReadAloudPreview — live (RA-B17)', () => {
  async function recordOne(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole('radio', { name: 'Live' }));
    port.nextTakeSeconds(5);
    await user.click(screen.getByRole('button', { name: 'Start recording' }));
    await flush();
    await user.click(screen.getByRole('button', { name: 'Stop' }));
    await flush();
  }

  it('records locally, hands in without a network and waits «hos læreren»', async () => {
    const { user } = renderPreview();
    await recordOne(user);
    expect(port.calls.start).toBe(1);
    const send = screen.getByRole('button', { name: 'Hand in to the teacher' });
    expect(send).toBeEnabled();
    await user.click(send);
    expect(screen.getByText('Handed in.')).toBeInTheDocument();
    expect(screen.getByText(/Live preview: records with your microphone/)).toBeInTheDocument();
  });

  it('simulates the teacher’s verdict with «2» on every criterion, and only here (Q8-A)', async () => {
    const { user } = renderPreview();
    await recordOne(user);
    await user.click(screen.getByRole('button', { name: 'Hand in to the teacher' }));
    await user.click(screen.getByRole('button', { name: "Simulate the teacher's verdict" }));
    const card = screen.getByRole('status', { name: '' });
    expect(within(card).getByText(/10 \/ 15/)).toBeInTheDocument();
    expect(screen.getAllByText("The teacher's comment appears here.").length).toBeGreaterThan(0);
    expect(
      screen.queryByRole('button', { name: "Simulate the teacher's verdict" }),
    ).not.toBeInTheDocument();
  });

  it('starts over on «restart», keeping nothing of the take', async () => {
    const { user } = renderPreview();
    await recordOne(user);
    await user.click(screen.getByRole('button', { name: 'Restart the attempt' }));
    expect(screen.getByRole('button', { name: 'Start recording' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Hand in to the teacher' })).toBeDisabled();
  });
});

describe('ReadAloudPreview — a11y', () => {
  it('has no axe violations', async () => {
    const { container } = renderPreview();
    expect((await axe.run(container, PAGE_RULES)).violations).toEqual([]);
  });
});

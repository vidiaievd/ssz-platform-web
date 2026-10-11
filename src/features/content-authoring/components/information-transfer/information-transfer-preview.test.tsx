import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { describe, expect, it, vi } from 'vitest';

import { SAMPLE_ANSWERS, SAMPLE_FIELD_IDS } from '@/lib/shared-kernel/information-transfer';

import { setAnswering, type InformationTransferDocument } from './edits';
import { InformationTransferPreview } from './information-transfer-preview';
import { blankDocument, Intl, PAGE_RULES, sampleDocument } from './test-support';

vi.mock('@/features/media', () => ({
  useMediaAsset: () => ({ data: undefined }),
  uploadAsset: vi.fn(),
}));

function renderPreview(ex: InformationTransferDocument) {
  const view = render(
    <Intl>
      <InformationTransferPreview exercise={ex} />
    </Intl>,
  );
  return { user: userEvent.setup(), ...view };
}

const LABELS = ['Dato', 'Klokkeslett', 'Rom', 'Pris', 'Telefon', 'Kontaktperson'];

/** The sample student's first go, typed into the blank. */
async function fill(user: ReturnType<typeof userEvent.setup>) {
  for (const [i, id] of SAMPLE_FIELD_IDS.entries()) {
    await user.type(screen.getByRole('textbox', { name: LABELS[i] }), SAMPLE_ANSWERS[id]!);
  }
}

describe('InformationTransferPreview (INF-B29)', () => {
  it('draws the runner body from the projection — no key, no reasons, no pass mark', () => {
    renderPreview(sampleDocument('text'));
    expect(screen.getByRole('radiogroup', { name: 'Device' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Klokkeslett' })).toBeInTheDocument();
    expect(screen.queryByText(/Halv seks/)).toBeNull();
    expect(screen.queryByText(/75/)).toBeNull();
  });

  it('shows the runner’s own empty state for a blank with no finished field', () => {
    renderPreview(blankDocument());
    expect(screen.getByText('No fields')).toBeInTheDocument();
  });

  it('runs the kernel check: notation forgiven, a wrong fact told its reason', async () => {
    const { user } = renderPreview(sampleDocument('text'));
    await fill(user);
    await user.click(screen.getByRole('button', { name: 'Check the answers' }));
    // «2» in the room is the floor — the author's reason, and the room is not counted.
    expect(await screen.findByText(/det er etasjen, ikke rommet/)).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Rom, wrong' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /^Klokkeslett, correct/ })).toBeInTheDocument();
    expect(screen.getByText(/5\s*\/\s*6|5\/6/)).toBeInTheDocument();
  });

  it('retries only the cells not counted and keeps the right ones', async () => {
    // Every cell must be right, so the one wrong room keeps the blank open for a second go.
    const doc = sampleDocument('text');
    doc.scoring = { ...doc.scoring, passPct: 100 };
    const { user } = renderPreview(doc);
    await fill(user);
    await user.click(screen.getByRole('button', { name: 'Check the answers' }));
    await user.click(await screen.findByRole('button', { name: /^Fix 1 field/ }));
    expect(screen.getByRole('textbox', { name: 'Rom' })).toHaveValue('');
    expect(screen.getByRole('textbox', { name: 'Klokkeslett' })).toHaveValue('kl 17.30');
  });

  it('draws nothing interactive in the static preview', async () => {
    const { user } = renderPreview(sampleDocument('text'));
    await user.click(screen.getByRole('radio', { name: 'Static' }));
    expect(screen.getByRole('textbox', { name: 'Klokkeslett' })).toBeDisabled();
  });

  it('shows the reader card on the third device', async () => {
    const { user } = renderPreview(setAnswering(sampleDocument('text'), { attempts: 3 }));
    await user.click(screen.getByRole('radio', { name: 'Reader card' }));
    expect(screen.getByText(/Reading · 6 fields/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start' })).toBeInTheDocument();
  });

  it('starts again on «Restart the attempt»', async () => {
    const { user } = renderPreview(sampleDocument('text'));
    await user.type(screen.getByRole('textbox', { name: 'Rom' }), '204');
    await user.click(screen.getByRole('button', { name: 'Restart the attempt' }));
    expect(screen.getByRole('textbox', { name: 'Rom' })).toHaveValue('');
  });

  it('has no accessibility violations', async () => {
    const { container } = renderPreview(sampleDocument('audio'));
    expect((await axe.run(container, PAGE_RULES)).violations).toEqual([]);
  });
});

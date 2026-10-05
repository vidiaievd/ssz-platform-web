import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import { readAudioDraft } from '@/lib/shared-kernel/audio';
import { emptyContent, sampleContent } from '@/lib/shared-kernel/inflection-table';

import type { InflectionTableDocument } from './edits';
import { InflectionTablePreview } from './inflection-table-preview';

vi.mock('@/features/media', () => ({
  useMediaAsset: () => ({ data: undefined }),
  uploadAsset: vi.fn(),
}));

const client = new QueryClient();
const PAGE_RULES = { rules: { region: { enabled: false }, 'color-contrast': { enabled: false } } };

const doc = (content = sampleContent()): InflectionTableDocument => ({
  ...content,
  updatedAt: 't0',
  audio: readAudioDraft({}, 'inflection_table'),
});

function renderPreview(ex: InflectionTableDocument) {
  const view = render(
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <InflectionTablePreview exercise={ex} />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
  return { user: userEvent.setup(), ...view };
}

const cell = (lemma: string, slot: string) =>
  screen.getByRole('textbox', { name: new RegExp(`^${lemma}, ${slot}`) });

describe('InflectionTablePreview', () => {
  it('says so when there is nothing a student would be handed', () => {
    renderPreview(doc({ ...emptyContent('nb') }));
    expect(screen.getByText(/Add a lemma with an asked cell/)).toBeInTheDocument();
  });

  it('draws the runner body from the projection — no key anywhere (IT-X4)', () => {
    renderPreview(doc());
    expect(screen.getByRole('radiogroup', { name: 'Device' })).toBeInTheDocument();
    expect(screen.queryByText('jobben')).not.toBeInTheDocument();
    expect(screen.queryByText(/Hankjønn/)).not.toBeInTheDocument();
  });

  it('runs the kernel check: a wrong cell is told the author’s reason, a right one is not', async () => {
    const { user } = renderPreview(doc());
    await user.type(cell('en jobb', 'Bestemt entall'), 'jobbe');
    await user.click(screen.getByRole('button', { name: 'Check' }));
    expect(await screen.findByText(/Hankjønn: -en i bestemt entall\./)).toBeInTheDocument();
    expect(screen.getByText(/of \d+ cells/)).toBeInTheDocument();
  });

  it('retries only the wrong cells and keeps the right ones', async () => {
    const { user } = renderPreview(doc());
    await user.type(cell('en jobb', 'Bestemt entall'), 'jobben');
    await user.type(cell('en jobb', 'Ubestemt flertall'), 'jobbe');
    await user.click(screen.getByRole('button', { name: 'Check' }));
    await user.click(await screen.findByRole('button', { name: /Retry the wrong ones/ }));
    expect(cell('en jobb', 'Ubestemt flertall')).toHaveValue('');
    expect(screen.getByDisplayValue('jobben')).toBeInTheDocument();
  });

  it('starts again when the table changes under it', async () => {
    const { user, rerender } = renderPreview(doc());
    await user.type(cell('en jobb', 'Bestemt entall'), 'jobbe');
    await user.click(screen.getByRole('button', { name: 'Check' }));
    expect(await screen.findByText(/of \d+ cells/)).toBeInTheDocument();
    const base = sampleContent();
    rerender(
      <QueryClientProvider client={client}>
        <NextIntlClientProvider locale="en" messages={enMessages}>
          <InflectionTablePreview exercise={doc({ ...base, rows: base.rows.slice(0, 2) })} />
        </NextIntlClientProvider>
      </QueryClientProvider>,
    );
    expect(screen.queryByText(/of \d+ cells/)).not.toBeInTheDocument();
  });

  it('switches to the reader card and back to the phone with its button', async () => {
    const { user } = renderPreview(doc());
    await user.click(screen.getByRole('radio', { name: 'Reader' }));
    await user.click(screen.getByRole('button', { name: 'Start the table' }));
    expect(screen.getByRole('radio', { name: 'VoxOrd' })).toBeChecked();
  });

  it('draws a static preview that accepts nothing', async () => {
    const { user } = renderPreview(doc());
    await user.click(screen.getByRole('radio', { name: 'Static' }));
    expect(cell('en jobb', 'Bestemt entall')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Check' })).toBeDisabled();
  });

  it('restarts the attempt on request', async () => {
    const { user } = renderPreview(doc());
    await user.type(cell('en jobb', 'Bestemt entall'), 'jobben');
    await user.click(screen.getByRole('button', { name: 'Restart the attempt' }));
    expect(cell('en jobb', 'Bestemt entall')).toHaveValue('');
  });

  it('has no axe violations on either device', async () => {
    const { container, user } = renderPreview(doc());
    expect((await axe.run(container, PAGE_RULES)).violations).toEqual([]);
    await user.click(screen.getByRole('radio', { name: 'Web' }));
    expect((await axe.run(container, PAGE_RULES)).violations).toEqual([]);
    expect(within(container).getByRole('radiogroup', { name: 'Device' })).toBeInTheDocument();
  });
});

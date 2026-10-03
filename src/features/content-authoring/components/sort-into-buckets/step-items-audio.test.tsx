import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import { readAudioDraft, withAudio, type AudioDraft } from '@/lib/shared-kernel/audio';
import { TEMPLATE_CODE, type SortIntoBucketsContent } from '@/lib/shared-kernel/sort-into-buckets';
import { exercise } from '@/lib/shared-kernel/sort-into-buckets/fixtures.test-support';

import { StepItems } from './step-items';

vi.mock('@/features/media', () => ({
  useMediaAsset: () => ({ data: undefined }),
  uploadAsset: vi.fn(),
}));

function renderStep(initial: AudioDraft) {
  const seen: { audio: AudioDraft } = { audio: initial };

  function Harness() {
    const [ex, setEx] = useState<SortIntoBucketsContent>(exercise());
    const [audio, setAudio] = useState(initial);
    return (
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <StepItems
          exercise={ex}
          onChange={setEx}
          audio={audio}
          onAudioChange={(next) => {
            seen.audio = next;
            setAudio(next);
          }}
        />
      </NextIntlClientProvider>
    );
  }

  render(<Harness />);
  return { user: userEvent.setup(), seen };
}

const off = () => readAudioDraft({}, TEMPLATE_CODE);
const on = (patch: Parameters<typeof withAudio>[1]) =>
  withAudio(off(), { enabled: true, ...patch });

describe('StepItems — the audio row (AC-D3)', () => {
  it('has no audio row while the layer is off', async () => {
    const { user } = renderStep(off());

    await user.click(screen.getByRole('button', { name: 'Details of item 1' }));

    expect(screen.queryByText('Recording of this item')).not.toBeInTheDocument();
    expect(screen.queryByText(/one clip for the whole task/)).not.toBeInTheDocument();
  });

  it('offers a recording on the item under per-item recordings', async () => {
    const { user } = renderStep(on({ source: 'items' }));

    await user.click(screen.getByRole('button', { name: 'Details of item 1' }));

    // The slot shows its label once something is attached; until then it is the button.
    expect(screen.getByRole('button', { name: 'Attach audio' })).toBeInTheDocument();
  });

  it('offers a timecode on the item under one clip with segments, and writes it to the draft', async () => {
    const { user, seen } = renderStep(on({ source: 'asset', useSegments: true }));

    await user.click(screen.getByRole('button', { name: 'Details of item 1' }));
    await user.type(screen.getByLabelText('From'), '0:05');
    await user.type(screen.getByLabelText('To'), '0:09');

    expect(seen.audio.segments['i1']).toEqual({ start: 5, end: 9 });
  });

  it('says the clip is shared when neither applies', async () => {
    const { user } = renderStep(on({ source: 'asset' }));

    await user.click(screen.getByRole('button', { name: 'Details of item 1' }));

    expect(screen.getByText(/one clip for the whole task/)).toBeInTheDocument();
  });
});

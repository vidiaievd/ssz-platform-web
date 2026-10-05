import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { NextIntlClientProvider } from 'next-intl';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import { readAudioDraft } from '@/lib/shared-kernel/audio';

import { StepAudio } from './step-audio';

vi.mock('@/features/media', () => ({
  useMediaAsset: () => ({ data: undefined }),
  uploadAsset: vi.fn(),
}));

function Harness() {
  const [audio, setAudio] = useState(readAudioDraft({}, 'inflection_table'));
  return (
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <StepAudio audio={audio} onAudioChange={setAudio} />
    </NextIntlClientProvider>
  );
}

const ENABLE = enMessages.Authoring.audio.enableLabel;
const PAGE_RULES = { rules: { region: { enabled: false }, 'color-contrast': { enabled: false } } };

describe('StepAudio (IT-B12)', () => {
  it('is off by default and shows only the switch', () => {
    render(<Harness />);
    expect(screen.getByRole('switch', { name: new RegExp(ENABLE) })).not.toBeChecked();
    expect(screen.getByText(/Listening is off/)).toBeInTheDocument();
    expect(screen.queryByText(/text \+ audio/)).not.toBeInTheDocument();
  });

  it('mounts the shared source and rules cards when switched on, and says what moves', async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole('switch', { name: new RegExp(ENABLE) }));
    expect(screen.getByRole('switch', { name: new RegExp(ENABLE) })).toBeChecked();
    expect(screen.getByText('text + audio')).toBeInTheDocument();
    expect(screen.queryByText(/Listening is off/)).not.toBeInTheDocument();
  });

  it('has no axe violations, on or off', async () => {
    const { container } = render(<Harness />);
    expect((await axe.run(container, PAGE_RULES)).violations).toEqual([]);
    await userEvent.click(screen.getByRole('switch', { name: new RegExp(ENABLE) }));
    expect((await axe.run(container, PAGE_RULES)).violations).toEqual([]);
  });
});

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import { readAudioDraft, type AudioDraft } from '@/lib/shared-kernel/audio';

import {
  AudioEnableRow,
  AudioRulesCard,
  AudioSegmentField,
  AudioSourceCard,
  AudioTranscriptCard,
} from './audio-cards';

vi.mock('@/features/media', () => ({
  useMediaAsset: () => ({ data: undefined }),
  uploadAsset: vi.fn(),
}));

const wrap = (ui: React.ReactElement) =>
  render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      {ui}
    </NextIntlClientProvider>,
  );

const draftWith = (audio: Record<string, unknown> = {}): AudioDraft =>
  readAudioDraft(
    {
      audio: {
        enabled: true,
        source: 'asset',
        assetId: 'asset-1',
        title: 'Dialog',
        duration: 96,
        ...audio,
        settings: { transcriptWhen: 'never', ...((audio['settings'] as object) ?? {}) },
      },
    },
    'multiple_choice',
  );

describe('AudioEnableRow', () => {
  it('turns listening on without touching anything else', async () => {
    const onChange = vi.fn();
    const draft = readAudioDraft({}, 'multiple_choice');
    wrap(<AudioEnableRow draft={draft} onChange={onChange} />);

    await userEvent.click(screen.getByRole('switch'));

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ segments: draft.segments }));
    expect(onChange.mock.calls[0]?.[0].audio.enabled).toBe(true);
  });

  it('keeps the material when it is switched off', async () => {
    // BEHAVIOR §1: switching off is not deleting. Re-enabling has to bring the clip and
    // the transcript back, so an author may try the exercise both ways.
    const onChange = vi.fn();
    wrap(
      <AudioEnableRow
        draft={draftWith({ transcript: 'Hei, jeg har vondt i halsen.' })}
        onChange={onChange}
      />,
    );

    await userEvent.click(screen.getByRole('switch'));

    const next: AudioDraft = onChange.mock.calls[0]?.[0];
    expect(next.audio.enabled).toBe(false);
    expect(next.audio.assetId).toBe('asset-1');
    expect(next.audio.transcript).toBe('Hei, jeg har vondt i halsen.');
  });
});

describe('AudioSourceCard', () => {
  it('offers a URL field for a linked clip', async () => {
    const onChange = vi.fn();
    wrap(<AudioSourceCard draft={draftWith({ source: 'link' })} onChange={onChange} />);

    await userEvent.type(screen.getByLabelText('Address of the clip'), 'h');
    expect(onChange.mock.calls[0]?.[0].audio.url).toBe('h');
  });

  it('takes the length as mm:ss and ignores what it cannot read', async () => {
    const onChange = vi.fn();
    wrap(<AudioSourceCard draft={draftWith()} onChange={onChange} />);

    const field = screen.getByLabelText('Length');
    await userEvent.clear(field);
    await userEvent.type(field, '1:36');

    // The keystrokes on the way there ("1", "1:", "1:3") are not valid lengths and must
    // not blank the field the author is typing into.
    const written = onChange.mock.calls.map((c) => c[0].audio.duration);
    expect(written.at(-1)).toBe(96);
    expect(written).not.toContain(0);
  });

  it('says the exercise can be built before the clip exists', () => {
    wrap(<AudioSourceCard draft={draftWith({ assetId: '' })} onChange={vi.fn()} />);
    expect(screen.getByText(/preview runs a simulated clip/)).toBeInTheDocument();
  });

  it('keeps the title and the transcript when the file is removed', async () => {
    const onChange = vi.fn();
    wrap(
      <AudioSourceCard
        draft={draftWith({ fileName: 'dialog.mp3', transcript: 'Hei.' })}
        onChange={onChange}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: /Remove/ }));

    const next: AudioDraft = onChange.mock.calls[0]?.[0];
    expect(next.audio.assetId).toBe('');
    expect(next.audio.title).toBe('Dialog');
    expect(next.audio.transcript).toBe('Hei.');
  });
});

describe('AudioRulesCard', () => {
  it('names the items of the host type in the lock', () => {
    wrap(<AudioRulesCard draft={draftWith()} onChange={vi.fn()} itemNoun="questions" />);
    expect(
      screen.getByText('Lock the questions until one full listen'),
    ).toBeInTheDocument();
  });

  it('tells the author that the listen limit is a browser count', async () => {
    const onChange = vi.fn();
    const { rerender } = wrap(
      <AudioRulesCard draft={draftWith()} onChange={onChange} itemNoun="questions" />,
    );
    // Unlimited says nothing, because there is nothing to warn about.
    expect(screen.queryByText(/reloading the page gives the listens back/)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('radio', { name: '2' }));
    const next: AudioDraft = onChange.mock.calls[0]?.[0];
    expect(next.audio.settings.plays).toBe(2);

    rerender(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <AudioRulesCard draft={next} onChange={onChange} itemNoun="questions" />
      </NextIntlClientProvider>,
    );
    expect(screen.getByText(/reloading the page gives the listens back/)).toBeInTheDocument();
  });
});

describe('AudioTranscriptCard', () => {
  it('marks the transcript as missing when the policy needs one', () => {
    wrap(
      <AudioTranscriptCard
        draft={draftWith({ settings: { transcriptWhen: 'after' } })}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByLabelText('What the clip says')).toHaveAttribute('data-bad', 'true');
    expect(screen.getByText('The policy shows a transcript, and none is written.')).toBeInTheDocument();
  });

  it('says plainly that "always" is the accessibility setting', async () => {
    const onChange = vi.fn();
    wrap(<AudioTranscriptCard draft={draftWith()} onChange={onChange} />);

    await userEvent.click(screen.getByRole('radio', { name: 'Always' }));

    expect(onChange.mock.calls[0]?.[0].audio.settings.transcriptWhen).toBe('always');
  });
});

describe('AudioSegmentField', () => {
  it('writes a timecode as a pair, and only once both halves parse', async () => {
    const onChange = vi.fn();
    wrap(<AudioSegmentField segment={null} onChange={onChange} />);

    await userEvent.type(screen.getByLabelText('From'), '0:22');
    expect(onChange).toHaveBeenLastCalledWith(null);

    await userEvent.type(screen.getByLabelText('To'), '0:48');
    expect(onChange).toHaveBeenLastCalledWith({ start: 22, end: 48 });
  });

  it('clears the timecode rather than leaving half of one', async () => {
    const onChange = vi.fn();
    wrap(<AudioSegmentField segment={{ start: 22, end: 48 }} onChange={onChange} />);

    await userEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(onChange).toHaveBeenLastCalledWith(null);
  });
});

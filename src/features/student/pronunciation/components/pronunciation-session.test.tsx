// @vitest-environment jsdom

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';

import messages from '../../../../../messages/en/Pronunciation.json';
import { PronunciationSession } from './pronunciation-session';

vi.mock('@/lib/i18n/navigation', () => ({
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const SESSION = {
  attemptId: 'a1',
  resumed: false,
  language: 'nb',
  basis: 'chosen',
  phase: 'drill',
  doneReason: null,
  takes: 0,
  maxTakes: 10,
  takeIndex: 0,
  sounds: [{ atomId: 'nb:kj', family: 'kj', status: 'open' }],
  diagnostic: null,
  step: {
    phase: 'drill',
    atomId: 'nb:kj',
    family: 'kj',
    elementIndex: 0,
    element: { kind: 'word', word: 'kino' },
    say: 'kino',
    sentence: 'Nå sier jeg kino igjen.',
    fails: 0,
  },
};

function renderScreen() {
  return render(
    <NextIntlClientProvider locale="en" messages={{ Pronunciation: messages }}>
      <PronunciationSession />
    </NextIntlClientProvider>,
  );
}

describe('PronunciationSession', () => {
  it('starts, shows the word in its frame with the base’s instruction, and warns about a low allowance', async () => {
    // The real parsers read the BFF's JSON, so go through them.
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url === '/api/sound-sessions') {
          return Response.json({
            ...SESSION,
            budget: { payer: 'learner', metered: true, remainingCredits: '3.000000', estimatedCredits: '15.000000' },
          });
        }
        return Response.json({
          session: SESSION,
          clips: [{ word: 'kino', url: 'https://x/kino.mp3', mimeType: 'audio/mpeg' }],
          instruction: { atomId: 'nb:kj', title: 'kj', howTo: 'Tongue behind the teeth', drill: null, commonError: null, ukNote: null },
        });
      }),
    );

    renderScreen();
    await userEvent.click(screen.getByRole('button', { name: 'Start a session' }));

    expect((await screen.findAllByText('kino')).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Listen: kino' })).toBeTruthy();
    expect(screen.getByText('Nå sier jeg kino igjen.')).toBeTruthy();
    expect(screen.getByText('Tongue behind the teeth')).toBeTruthy();
    expect(screen.getByRole('note').textContent).toContain('3 of about 15');
    expect(screen.getByRole('button', { name: 'Record' })).toBeTruthy();
  });

  it('says why the door was closed', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ error: 'Refused', code: 'SESSION_LIMIT' }, { status: 422 })),
    );
    renderScreen();
    await userEvent.click(screen.getByRole('button', { name: 'Start a session' }));
    expect((await screen.findByRole('alert')).textContent).toContain("today's sessions");
  });
});

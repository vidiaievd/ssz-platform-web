import { render, screen } from '@testing-library/react';
import { createTranslator } from 'next-intl';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { enMessages as en } from '@/lib/i18n/messages';

vi.mock('next-intl/server', () => ({
  getTranslations: async (namespace: 'Mastery') =>
    createTranslator({ locale: 'en', messages: en, namespace }),
}));

vi.mock('./api/get-my-standing', () => ({ getMyStanding: vi.fn() }));

import { getMyStanding } from './api/get-my-standing';
import { WhereYouStand } from './where-you-stand';

beforeEach(() => vi.mocked(getMyStanding).mockReset());

describe('WhereYouStand', () => {
  it('gives the band in words and nothing else', async () => {
    vi.mocked(getMyStanding).mockResolvedValue({ band: 'middle', groupName: 'NO-A2-2026' });

    render(await WhereYouStand({ userId: 'u1' }));

    expect(screen.getByText('You are around the middle of your group')).toBeInTheDocument();
    expect(screen.getByText(/NO-A2-2026/)).toBeInTheDocument();
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
    expect(screen.queryByText(/median/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/\bp\d/)).not.toBeInTheDocument();
  });

  it('says nothing when there is no position to give', async () => {
    vi.mocked(getMyStanding).mockResolvedValue(null);
    expect(await WhereYouStand({ userId: 'u1' })).toBeNull();
  });
});

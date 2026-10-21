import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import { EntitlementsProvider, type Entitlements } from '@/features/entitlements';

vi.mock('@/lib/config/feature-flags', () => ({ GAPFILL_AI_DRAFTS_ENABLED: true }));

const { DraftAction } = await import('./draft-panel');

function rights(authoring: boolean): Entitlements {
  return {
    account: { type: 'workspace', externalId: 'w1' },
    features: { 'ai.authoring': { enabled: authoring, monthlyCredits: '500', limits: {} } },
    validUntil: '2026-11-21T00:00:00.000Z',
    version: 1,
  };
}

function renderAction(entitlements: Entitlements | null | undefined) {
  const action = <DraftAction onDraft={() => undefined} />;
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      {entitlements === undefined ? (
        action
      ) : (
        <EntitlementsProvider entitlements={entitlements}>{action}</EntitlementsProvider>
      )}
    </NextIntlClientProvider>,
  );
}

const label = enMessages.Authoring.gapFill.draft.action;

describe('DraftAction with the flag on', () => {
  it('is drawn when the plan carries ai.authoring', () => {
    renderAction(rights(true));
    expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
  });

  it('is absent when the plan has the key switched off', () => {
    renderAction(rights(false));
    expect(screen.queryByRole('button', { name: label })).not.toBeInTheDocument();
  });

  it('is absent when the rights could not be read', () => {
    renderAction(null);
    expect(screen.queryByRole('button', { name: label })).not.toBeInTheDocument();
  });

  it('is absent outside any rights provider', () => {
    renderAction(undefined);
    expect(screen.queryByRole('button', { name: label })).not.toBeInTheDocument();
  });
});

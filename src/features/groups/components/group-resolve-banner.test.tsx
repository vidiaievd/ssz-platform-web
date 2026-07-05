import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { createTranslator } from 'next-intl';

import { enMessages as en } from '@/lib/i18n/messages';
import { GroupResolveBanner } from './group-resolve-banner';
import type { Alert } from '@/features/dashboard/types';

// next-intl/server's `getTranslations` requires a Next.js request context that
// isn't present under jsdom; substitute the same messages via `createTranslator`.
vi.mock('next-intl/server', () => ({
  getTranslations: async (namespace: 'Groups') =>
    createTranslator({ locale: 'en', messages: en, namespace }),
}));

const noPrimaryAlert: Alert = { type: 'no-primary', severity: 'danger', label: 'No primary teacher' };
const conflictAlert: Alert = { type: 'conflict', severity: 'warn', label: 'Schedule clash' };
const overAlert: Alert = { type: 'over', severity: 'warn', label: 'Over capacity' };

async function renderBanner(props: Omit<Parameters<typeof GroupResolveBanner>[0], 'groupId' | 'schoolSlug'>) {
  const element = await GroupResolveBanner({
    groupId: 'g1',
    schoolSlug: 'my-school',
    ...props,
  });
  return render(element);
}

describe('GroupResolveBanner', () => {
  it('renders nothing when there are no alerts', async () => {
    const element = await GroupResolveBanner({ alerts: [], groupId: 'g1', schoolSlug: 'my-school', canManage: true });
    expect(element).toBeNull();
  });

  it('links "no-primary" alerts to the assign-teacher route with role=primary', async () => {
    await renderBanner({ alerts: [noPrimaryAlert], canManage: true });
    const link = screen.getByRole('link', { name: 'Fix →' });
    expect(link).toHaveAttribute('href', '/school/my-school/groups/g1/assign-teacher?role=primary');
  });

  it('links "conflict" alerts to the assign-teacher route', async () => {
    await renderBanner({ alerts: [conflictAlert], canManage: true });
    const link = screen.getByRole('link', { name: 'Fix →' });
    expect(link).toHaveAttribute('href', '/school/my-school/groups/g1/assign-teacher');
  });

  it('links "over"/"under" alerts to the add-students route', async () => {
    await renderBanner({ alerts: [overAlert], canManage: true });
    const link = screen.getByRole('link', { name: 'Fix →' });
    expect(link).toHaveAttribute('href', '/school/my-school/groups/g1/add-students');
  });

  it('hides "Fix →" links for a teacher (non-manager)', async () => {
    await renderBanner({ alerts: [noPrimaryAlert], canManage: false });
    expect(screen.queryByRole('link', { name: 'Fix →' })).not.toBeInTheDocument();
  });
});

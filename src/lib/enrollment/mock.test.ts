// @vitest-environment node

import { describe, it, expect, beforeEach } from 'vitest';
import { mockProvider, resetMockStore } from './mock';

beforeEach(() => {
  resetMockStore();
});

describe('mockProvider — create → placement → review → assign → active', () => {
  it('completes the full onboarding flow for a high-touch school', async () => {
    // 1. Create membership at a school that requires interview (default settings)
    const m1 = await mockProvider.createMembership({
      schoolSlug: 'oslo-language-school',
      source: 'public-apply',
      language: 'nb',
    });
    expect(m1.status).toBe('pending');

    // 2. Admin approves → onboarding
    const m2 = await mockProvider.transition(m1.id, 'onboarding');
    expect(m2.status).toBe('onboarding');

    // 3. Student submits platform placement result
    const m3 = await mockProvider.submitPlacement(m1.id, {
      language: 'nb',
      cefrLevel: 'B1',
      score: 75,
      takenAt: '2026-06-01',
      scope: 'platform',
      sourceLabel: 'platform',
    });
    expect(m3.placement).toBeDefined();
    expect(m3.placement!.cefrLevel).toBe('B1');

    // 4. Student submits availability
    const m4 = await mockProvider.submitAvailability(m1.id, [
      { day: 'Mon', from: '18:00', to: '20:00' },
    ]);
    expect(m4.availability).toHaveLength(1);

    // 5. Move to placement-review (interview required school)
    const m5 = await mockProvider.transition(m1.id, 'placement-review');
    expect(m5.status).toBe('placement-review');

    // 6. Admin checks placement queue
    const queue = await mockProvider.listPlacementQueue('oslo-language-school');
    expect(queue).toHaveLength(1);
    expect(queue[0]?.id).toBe(m1.id);

    // 7. Admin assigns to group → active
    const m6 = await mockProvider.assignToGroup(m1.id, 'group-b1-mon');
    expect(m6.status).toBe('active');
    expect(m6.groupId).toBe('group-b1-mon');
  });

  it('open-school shortcut: auto-approval → onboarding on create', async () => {
    const m = await mockProvider.createMembership({
      schoolSlug: 'open-school',
      source: 'public-apply',
      language: 'en',
    });
    // open-school has approval.mode='auto' → starts in onboarding
    expect(m.status).toBe('onboarding');
  });

  it('rejects an invalid transition', async () => {
    const m = await mockProvider.createMembership({
      schoolSlug: 'oslo-language-school',
      source: 'invite',
      language: 'nb',
    });
    await expect(mockProvider.transition(m.id, 'active')).rejects.toThrow();
  });
});

describe('mockProvider — admin queues', () => {
  it('listPendingApprovals returns only pending memberships for the school', async () => {
    await mockProvider.createMembership({ schoolSlug: 'oslo-language-school', source: 'public-apply', language: 'nb' });
    await mockProvider.createMembership({ schoolSlug: 'oslo-language-school', source: 'public-apply', language: 'nb' });
    const m3 = await mockProvider.createMembership({ schoolSlug: 'oslo-language-school', source: 'public-apply', language: 'nb' });
    await mockProvider.transition(m3.id, 'rejected');

    const approvals = await mockProvider.listPendingApprovals('oslo-language-school');
    expect(approvals).toHaveLength(2);
    expect(approvals.every((m) => m.status === 'pending')).toBe(true);
  });
});

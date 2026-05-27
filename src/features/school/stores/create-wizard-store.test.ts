import { beforeEach, describe, expect, it } from 'vitest';

import { useCreateWizardStore } from './create-wizard-store';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

beforeEach(() => {
  useCreateWizardStore.setState({
    step: 'basics',
    schoolId: null,
    basicsDraft: {
      name: '',
      slug: '',
      slugEditedByUser: false,
      description: '',
      logoUrl: '',
      website: '',
      contactEmail: '',
      city: '',
    },
    invitesDraft: [{ email: '', role: 'STUDENT' }],
    isSaving: false,
    lastError: null,
    descriptionTab: 'write',
  });
});

describe('useCreateWizardStore', () => {
  describe('setStep', () => {
    it('transitions from basics to invite', () => {
      useCreateWizardStore.getState().setStep('invite');
      expect(useCreateWizardStore.getState().step).toBe('invite');
    });

    it('transitions to done', () => {
      useCreateWizardStore.getState().setStep('done');
      expect(useCreateWizardStore.getState().step).toBe('done');
    });
  });

  describe('setSchoolId', () => {
    it('stores the school id', () => {
      useCreateWizardStore.getState().setSchoolId('school-abc');
      expect(useCreateWizardStore.getState().schoolId).toBe('school-abc');
    });
  });

  describe('setBasicsDraft', () => {
    it('merges a partial update, preserving unchanged fields', () => {
      useCreateWizardStore.getState().setBasicsDraft({ name: 'Oslo School' });
      const { basicsDraft } = useCreateWizardStore.getState();
      expect(basicsDraft.name).toBe('Oslo School');
      expect(basicsDraft.description).toBe('');
      expect(basicsDraft.logoUrl).toBe('');
    });

    it('applies successive partial updates correctly', () => {
      useCreateWizardStore.getState().setBasicsDraft({ name: 'Oslo School' });
      useCreateWizardStore.getState().setBasicsDraft({ description: 'Learn Norwegian.' });
      const { basicsDraft } = useCreateWizardStore.getState();
      expect(basicsDraft.name).toBe('Oslo School');
      expect(basicsDraft.description).toBe('Learn Norwegian.');
    });
  });

  describe('setInvitesDraft', () => {
    it('replaces the invites array', () => {
      useCreateWizardStore
        .getState()
        .setInvitesDraft([{ email: 'teacher@school.no', role: 'TEACHER' }]);
      const { invitesDraft } = useCreateWizardStore.getState();
      expect(invitesDraft).toHaveLength(1);
      expect(invitesDraft[0]?.email).toBe('teacher@school.no');
      expect(invitesDraft[0]?.role).toBe('TEACHER');
    });
  });

  describe('setIsSaving / setLastError', () => {
    it('sets isSaving flag', () => {
      useCreateWizardStore.getState().setIsSaving(true);
      expect(useCreateWizardStore.getState().isSaving).toBe(true);
      useCreateWizardStore.getState().setIsSaving(false);
      expect(useCreateWizardStore.getState().isSaving).toBe(false);
    });

    it('stores and clears an error message', () => {
      useCreateWizardStore.getState().setLastError('Network error');
      expect(useCreateWizardStore.getState().lastError).toBe('Network error');
      useCreateWizardStore.getState().setLastError(null);
      expect(useCreateWizardStore.getState().lastError).toBeNull();
    });
  });

  describe('reset', () => {
    it('returns step to basics and clears schoolId', () => {
      useCreateWizardStore.getState().setStep('done');
      useCreateWizardStore.getState().setSchoolId('school-xyz');
      useCreateWizardStore.getState().reset();
      const state = useCreateWizardStore.getState();
      expect(state.step).toBe('basics');
      expect(state.schoolId).toBeNull();
    });

    it('clears basicsDraft and invitesDraft', () => {
      useCreateWizardStore.getState().setBasicsDraft({ name: 'To be cleared' });
      useCreateWizardStore.getState().setInvitesDraft([{ email: 'x@y.com', role: 'STUDENT' }]);
      useCreateWizardStore.getState().reset();
      const { basicsDraft, invitesDraft } = useCreateWizardStore.getState();
      expect(basicsDraft.name).toBe('');
      expect(invitesDraft[0]?.email).toBe('');
    });

    it('generates a new idempotencyKey that is a valid v4 UUID', () => {
      const keyBefore = useCreateWizardStore.getState().idempotencyKey;
      useCreateWizardStore.getState().reset();
      const keyAfter = useCreateWizardStore.getState().idempotencyKey;
      expect(keyAfter).toMatch(UUID_REGEX);
      expect(keyAfter).not.toBe(keyBefore);
    });
  });
});

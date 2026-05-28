import { beforeEach, describe, expect, it } from 'vitest';

import { useCreateWizardStore } from './create-wizard-store';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

beforeEach(() => {
  useCreateWizardStore.setState({
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
    isSaving: false,
    lastError: null,
  });
});

describe('useCreateWizardStore', () => {
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
    it('clears basicsDraft', () => {
      useCreateWizardStore.getState().setBasicsDraft({ name: 'To be cleared' });
      useCreateWizardStore.getState().reset();
      expect(useCreateWizardStore.getState().basicsDraft.name).toBe('');
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

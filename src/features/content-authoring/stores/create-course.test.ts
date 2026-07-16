import { afterEach, describe, expect, it } from 'vitest';

import { useCreateCourseStore } from './create-course';

const initialState = useCreateCourseStore.getState();

afterEach(() => {
  useCreateCourseStore.setState(initialState, true);
});

describe('useCreateCourseStore', () => {
  it('defaults to the wizard flow, step 0, CEFR levels, CEFR starter', () => {
    const s = useCreateCourseStore.getState();
    expect(s.flow).toBe('wizard');
    expect(s.step).toBe(0);
    expect(s.levelSystem).toBe('cefr');
    expect(s.starter).toBe('cefr');
    expect(s.basics).toEqual({ title: '', targetLanguage: '', description: '' });
  });

  it('updateBasics merges into the existing basics draft', () => {
    useCreateCourseStore.getState().updateBasics({ title: 'Norsk A1' });
    useCreateCourseStore.getState().updateBasics({ targetLanguage: 'nb' });
    expect(useCreateCourseStore.getState().basics).toEqual({
      title: 'Norsk A1',
      targetLanguage: 'nb',
      description: '',
    });
  });

  it('setFlow, setStep, setLevelSystem, setStarter, setCreating update their fields', () => {
    const store = useCreateCourseStore.getState();
    store.setFlow('quick');
    store.setStep(2);
    store.setLevelSystem('single');
    store.setStarter('blank');
    store.setCreating(true);
    const s = useCreateCourseStore.getState();
    expect(s.flow).toBe('quick');
    expect(s.step).toBe(2);
    expect(s.levelSystem).toBe('single');
    expect(s.starter).toBe('blank');
    expect(s.isCreating).toBe(true);
  });

  it('reset restores all fields to their initial values', () => {
    const store = useCreateCourseStore.getState();
    store.setFlow('quick');
    store.updateBasics({ title: 'Norsk A1' });
    store.setLevelSystem('custom');
    store.setStarter('clone');
    store.setCreating(true);
    store.reset();
    const s = useCreateCourseStore.getState();
    expect(s.flow).toBe('wizard');
    expect(s.step).toBe(0);
    expect(s.isCreating).toBe(false);
    expect(s.basics).toEqual({ title: '', targetLanguage: '', description: '' });
    expect(s.levelSystem).toBe('cefr');
    expect(s.starter).toBe('cefr');
  });
});

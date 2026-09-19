import { describe, expect, it } from 'vitest';

import { BY_TEMPLATE } from '@/lib/shared-kernel/skills/by-template';
import { enMessages } from '@/lib/i18n/messages';

import { CREATABLE_EXERCISE_TYPES } from '../schemas/exercise';

import { EXERCISE_TYPES, exerciseType, liveExerciseTypes } from './exercise-type-registry';

describe('exercise type registry', () => {
  // The kernel's table is what the coverage report counts the catalogue with; a
  // type missing from this registry would be counted and drawn as nothing.
  it('knows every template the kernel knows', () => {
    for (const code of Object.keys(BY_TEMPLATE)) {
      expect(exerciseType(code)?.status).toBe('live');
    }
  });

  it('marks every type an author can create as live', () => {
    for (const code of CREATABLE_EXERCISE_TYPES) {
      expect(exerciseType(code)?.status).toBe('live');
    }
  });

  // Spec 19 §3: a catalogue entry does not make a type authorable — it has no
  // template in the seed and no validator in the engine.
  it('keeps planned types out of the add-block menu', () => {
    const planned = Object.values(EXERCISE_TYPES).filter((t) => t.status === 'planned');
    expect(planned.length).toBeGreaterThan(0);
    for (const type of planned) {
      expect(CREATABLE_EXERCISE_TYPES).not.toContain(type.code as never);
      // The recipe needs to know what a type would train before it exists.
      expect(type.axes).toBeDefined();
    }
  });

  // A live type's axes come from the kernel. Restating them here would be a
  // second scale to keep in step with the first.
  it('does not restate the axes of a live type', () => {
    for (const type of liveExerciseTypes()) {
      expect(type.axes).toBeUndefined();
    }
  });

  it('has a label for every type, planned ones included', () => {
    const labels = enMessages.Authoring.exercises.types as Record<string, string>;
    for (const type of Object.values(EXERCISE_TYPES)) {
      expect(labels[type.labelKey], type.code).toBeTruthy();
    }
  });

  // The pictogram is what tells two exercises apart at a glance; two types
  // sharing a drawing would put the section back where it started.
  it('draws each type differently, bar the two that are one act', () => {
    const live = liveExerciseTypes();
    const icons = new Set(live.map((t) => t.icon));
    expect(icons.size).toBe(live.length);
  });

  it('answers nothing for a code no catalogue knows', () => {
    expect(exerciseType('no_such_template')).toBeUndefined();
    expect(exerciseType(null)).toBeUndefined();
    expect(exerciseType(undefined)).toBeUndefined();
  });
});

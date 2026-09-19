import { describe, expect, it } from 'vitest';

import { deriveSkills } from '@/lib/shared-kernel/skills';

import type { ExerciseAxes } from '../types';

import { mergeAxes } from './live-axes';

const saved = (over: Partial<ExerciseAxes> = {}): ExerciseAxes => ({
  skills: ['reading'],
  focus: ['vocabulary'],
  form: 'bank',
  skillSource: 'template',
  focusSource: 'atoms',
  ...over,
});

describe('mergeAxes', () => {
  // The whole point of the card: the toggle moves the channel now, not after a save.
  it('lets the document in hand move the channel', () => {
    const draft = deriveSkills({
      templateCode: 'short_answer',
      content: { audio: { enabled: true } },
    });

    const axes = mergeAxes(saved(), draft);

    expect(axes.skills).toEqual(['listening']);
    expect(axes.skillSource).toBe('document');
  });

  // Where the exercise stands outranks what its document says, and the builder
  // cannot see where it stands.
  it('keeps a placement the builder cannot know about', () => {
    const draft = deriveSkills({ templateCode: 'short_answer' });

    const axes = mergeAxes(saved({ skills: ['listening'], skillSource: 'placement' }), draft);

    expect(axes.skills).toEqual(['listening']);
    expect(axes.skillSource).toBe('placement');
  });

  it('keeps what the author declared, whatever the draft says', () => {
    const draft = deriveSkills({
      templateCode: 'short_answer',
      content: { audio: { enabled: true } },
    });

    const axes = mergeAxes(
      saved({ skills: ['written'], form: 'free', skillSource: 'override' }),
      draft,
    );

    expect(axes.skills).toEqual(['written']);
    expect(axes.skillSource).toBe('override');
    expect(axes.form).toBe('free');
  });

  // The subject comes from the atom graph, which the builder does not hold.
  it('never takes the subject from the draft', () => {
    const draft = deriveSkills({ templateCode: 'error_correction' });

    const axes = mergeAxes(saved({ focus: ['vocabulary'], focusSource: 'atoms' }), draft);

    expect(axes.focus).toEqual(['vocabulary']);
    expect(axes.focusSource).toBe('atoms');
  });

  it('stands on the draft alone before the service has answered', () => {
    const draft = deriveSkills({
      templateCode: 'word_bank_gap_fill',
      content: { settings: { input: 'free' } },
    });

    const axes = mergeAxes(undefined, draft);

    expect(axes.skills).toEqual(['written']);
    expect(axes.form).toBe('free');
    expect(axes.focusSource).toBe('unknown');
  });
});

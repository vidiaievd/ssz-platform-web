import { describe, expect, it } from 'vitest';

import { RECIPE_PRESETS, type RecipeRule } from '@/lib/shared-kernel/skills';

import { remediesFor } from './recipe-remedies';

const codes = (rule: RecipeRule) => {
  const { live, planned, audioLayer } = remediesFor(rule);
  return { live: live.map((t) => t.code), planned: planned.map((t) => t.code), audioLayer };
};

describe('remediesFor', () => {
  // The check of plan 64, phase 10: a lesson of choices is told to add a short
  // answer, a translation or a piece of writing.
  it('names the producing types for "the learner makes something"', () => {
    const { live } = codes({ axis: 'output', values: ['none'], negate: true, min: 1 });

    expect(live).toEqual(
      expect.arrayContaining(['short_answer', 'writing_task', 'translate_to_target']),
    );
    expect(live).not.toContain('multiple_choice');
    expect(live).not.toContain('match_pairs');
  });

  // Dictation is the one bare template that is heard (plan 68); for the rest the cure is
  // the recording.
  it('sends a listening rule to dictation, the audio layer and the planned listening types', () => {
    const result = codes({ axis: 'input', values: ['audio', 'video'], min: 1 });

    expect(result.live).toEqual(['dictation']);
    expect(result.audioLayer).toBe(true);
    expect(result.planned).toEqual(expect.arrayContaining(['minimal_pairs']));
    expect(result.planned).not.toContain('dictation');
  });

  // Adding more of what a ceiling caps only makes it worse.
  it('advises the opposite of what a ceiling counts', () => {
    const { live, audioLayer } = codes({
      axis: 'modality',
      values: ['recognition'],
      maxShare: 0.6,
    });

    expect(live).toContain('short_answer');
    expect(live).not.toContain('multiple_choice');
    expect(audioLayer).toBe(false);
  });

  // `word_bank_gap_fill` decides in its document; judged in neither mode it would
  // never be advised for anything.
  it('judges a template in each of its modes', () => {
    expect(codes({ axis: 'modality', values: ['recall'], min: 1 }).live).toContain(
      'word_bank_gap_fill',
    );
  });

  it('never advises a retired type', () => {
    for (const id of Object.keys(RECIPE_PRESETS) as (keyof typeof RECIPE_PRESETS)[])
      for (const rule of RECIPE_PRESETS[id].rules as readonly RecipeRule[]) {
        const { live } = codes(rule);
        expect(live).not.toContain('fill_in_blank');
        expect(live).not.toContain('word_bank_fill');
      }
  });

  it('can say that nothing closes a rule yet', () => {
    expect(codes({ axis: 'focus', values: ['pragmatics'], min: 1 })).toEqual({
      live: [],
      planned: [],
      audioLayer: false,
    });
  });
});

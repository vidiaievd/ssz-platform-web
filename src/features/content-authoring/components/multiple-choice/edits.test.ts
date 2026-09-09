import { describe, expect, it } from 'vitest';

import { correctOption, filledOptions } from '@/lib/shared-kernel/multiple-choice';
import { content, option, question } from '@/lib/shared-kernel/multiple-choice/fixtures.test-support';

import {
  addOption,
  addQuestion,
  applyBulkPaste,
  duplicateQuestion,
  markKey,
  MAX_OPTIONS,
  removeOption,
  removeQuestion,
  setKind,
  setOption,
  setQuestion,
} from './edits';

const doc = (overrides = {}) => ({ updatedAt: '2026-08-28T10:00:00.000Z', ...content(overrides) });

describe('multiple-choice edits', () => {
  it('marks one option as the key and clears every other', () => {
    const next = markKey(doc(), 'q1', 'c');

    expect(correctOption(next.questions[0]!)?.id).toBe('c');
    expect(next.questions[0]!.options.filter((o) => o.correct)).toHaveLength(1);
  });

  it('keeps a passage when the kind stops offering one', () => {
    const withPassage = doc({ questions: [question({ kind: 'reading', context: 'En tekst.' })] });

    const next = setKind(withPassage, 'q1', 'grammar');

    // The projection decides what a student sees from `kind`, so a kept passage cannot
    // leak — and an author correcting a mislabelled question must not lose what they
    // pasted.
    expect(next.questions[0]!.context).toBe('En tekst.');
  });

  it('adds a question with three empty options and no key', () => {
    const next = addQuestion(doc());

    const added = next.questions[1]!;
    expect(added.options).toHaveLength(3);
    expect(filledOptions(added)).toHaveLength(0);
    expect(correctOption(added)).toBeNull();
  });

  it('duplicates a question after the original with fresh ids throughout', () => {
    const next = duplicateQuestion(doc(), 'q1');

    const [original, copy] = next.questions;
    expect(next.questions).toHaveLength(2);
    expect(copy!.id).not.toBe(original!.id);
    expect(copy!.stem).toBe(original!.stem);
    // The key column is keyed by question id and by option id inside it: a copy that
    // reused them would give two questions one shared key.
    for (const id of copy!.options.map((o) => o.id)) {
      expect(original!.options.map((o) => o.id)).not.toContain(id);
    }
    expect(correctOption(copy!)?.text).toBe('var');
  });

  it('removes a question without asking', () => {
    expect(removeQuestion(doc(), 'q1').questions).toHaveLength(0);
  });

  it('refuses to take a question below two options', () => {
    const pair = doc({
      questions: [
        question({ options: [option({ id: 'a', text: 'Riktig', correct: true }), option({ id: 'b', text: 'Galt' })] }),
      ],
    });

    expect(removeOption(pair, 'q1', 'b').questions[0]!.options).toHaveLength(2);
  });

  it('stops adding options at eight', () => {
    let ex = doc();
    for (let i = 0; i < 10; i += 1) ex = addOption(ex, 'q1');

    expect(ex.questions[0]!.options).toHaveLength(MAX_OPTIONS);
  });

  it('writes an option rebuttal without touching the rest of the row', () => {
    const next = setOption(doc(), 'q1', 'a', { why: 'Presens holder ikke her.' });

    const edited = next.questions[0]!.options[0]!;
    expect(edited.why).toBe('Presens holder ikke her.');
    expect(edited.text).toBe('er');
  });

  it('writes the rule behind the right answer', () => {
    expect(setQuestion(doc(), 'q1', { why: 'V2.' }).questions[0]!.why).toBe('V2.');
  });

  it('appends a bulk paste and re-mints its ids', () => {
    const next = applyBulkPaste(doc(), 'Hun ___ boka. | *leste | leser\nHan ___ seg. | unnskyldte | beklaget');

    expect(next.questions).toHaveLength(3);
    expect(next.questions[1]!.stem).toBe('Hun ___ boka.');
    expect(correctOption(next.questions[1]!)?.text).toBe('leste');
    // No `*` on the second line: the first option becomes the key.
    expect(correctOption(next.questions[2]!)?.text).toBe('unnskyldte');
    expect(new Set(next.questions.map((q) => q.id)).size).toBe(3);
  });
});

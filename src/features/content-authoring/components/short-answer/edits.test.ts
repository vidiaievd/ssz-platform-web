import { describe, expect, it } from 'vitest';

import {
  emptyContent,
  usableElements,
  type ShortAnswerContent,
} from '@/lib/shared-kernel/short-answer';

import {
  addAnchor,
  addElement,
  addQuestion,
  duplicateQuestion,
  MAX_ELEMENTS,
  removeAnchor,
  removeElement,
  removeQuestion,
  setElement,
  setKind,
  setQuestion,
  setSettings,
  type ShortAnswerDocument,
} from './edits';

function doc(overrides: Partial<ShortAnswerContent> = {}): ShortAnswerDocument {
  return {
    updatedAt: '2026-08-23T10:00:00.000Z',
    ...emptyContent(),
    ...overrides,
  };
}

/** The one question `emptyContent` scaffolds, filled in enough to be worth editing. */
function written(): ShortAnswerDocument {
  const base = doc();
  const q = base.questions[0]!;
  return setElement(
    addAnchor(
      setQuestion(base, q.id, {
        prompt: 'Hvorfor kom regelen?',
        model: 'Regelen kom fordi det var for mange ulykker.',
        why: 'Teksten sier hvorfor.',
      }),
      q.id,
      q.elements[0]!.id,
      'for mange ulykker',
    ),
    q.id,
    q.elements[0]!.id,
    { label: 'formålet' },
  );
}

describe('setQuestion', () => {
  it('rewrites only the question named', () => {
    const before = addQuestion(doc());
    const [first, second] = before.questions;

    const next = setQuestion(before, second!.id, { prompt: 'Hva er nytt?' });

    expect(next.questions[1]!.prompt).toBe('Hva er nytt?');
    expect(next.questions[0]).toBe(first);
  });
});

describe('setKind', () => {
  it('keeps a passage the author already pasted when the kind loses its field', () => {
    const base = doc();
    const q = base.questions[0]!;
    const before = setQuestion(base, q.id, { passage: 'Teksten.' });

    const next = setKind(before, q.id, 'opinion');

    expect(next.questions[0]!.kind).toBe('opinion');
    expect(next.questions[0]!.passage).toBe('Teksten.');
  });
});

describe('addQuestion', () => {
  it('appends a reading question with one empty element', () => {
    const next = addQuestion(doc());

    expect(next.questions).toHaveLength(2);
    expect(next.questions[1]!.kind).toBe('reading');
    expect(next.questions[1]!.elements).toHaveLength(1);
    expect(usableElements(next.questions[1]!)).toHaveLength(0);
  });

  it('mints an id nothing else in the document carries', () => {
    const next = addQuestion(addQuestion(doc()));
    const ids = next.questions.map((q) => q.id);

    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('duplicateQuestion', () => {
  it('inserts the copy directly after the original', () => {
    const before = addQuestion(written());
    const next = duplicateQuestion(before, before.questions[0]!.id);

    expect(next.questions).toHaveLength(3);
    expect(next.questions[1]!.prompt).toBe(before.questions[0]!.prompt);
    expect(next.questions[2]!.id).toBe(before.questions[1]!.id);
  });

  it('gives the copy new ids for the question and for every element', () => {
    const seeded = written();
    const before = addElement(seeded, seeded.questions[0]!.id);
    const source = before.questions[0]!;

    const next = duplicateQuestion(before, source.id);
    const copy = next.questions[1]!;

    expect(copy.id).not.toBe(source.id);
    expect(copy.elements.map((e) => e.id)).not.toEqual(source.elements.map((e) => e.id));
    expect(new Set(copy.elements.map((e) => e.id)).size).toBe(copy.elements.length);
  });

  it('carries the key across, so the copy grades exactly as the original did', () => {
    const before = written();
    const next = duplicateQuestion(before, before.questions[0]!.id);

    expect(next.questions[1]!.elements[0]!.anchors).toEqual(['for mange ulykker']);
    expect(next.questions[1]!.model).toBe(before.questions[0]!.model);
  });
});

describe('removeQuestion', () => {
  it('removes the last question too — an empty set is a blocker, not an impossibility', () => {
    const before = doc();

    const next = removeQuestion(before, before.questions[0]!.id);

    expect(next.questions).toHaveLength(0);
  });
});

describe('addElement', () => {
  it('stops at MAX_ELEMENTS', () => {
    const base = doc();
    const id = base.questions[0]!.id;
    let next = base;
    for (let i = 0; i < MAX_ELEMENTS + 3; i += 1) next = addElement(next, id);

    expect(next.questions[0]!.elements).toHaveLength(MAX_ELEMENTS);
  });

  it('mints an id nothing else on the question carries', () => {
    const base = doc();
    const next = addElement(addElement(base, base.questions[0]!.id), base.questions[0]!.id);
    const ids = next.questions[0]!.elements.map((e) => e.id);

    expect(new Set(ids).size).toBe(ids.length);
  });

  it('returns the document untouched for a question that is gone', () => {
    const before = doc();
    expect(addElement(before, 'no-such-question')).toBe(before);
  });
});

describe('removeElement', () => {
  it('refuses to remove the last element', () => {
    const before = doc();
    const q = before.questions[0]!;

    expect(removeElement(before, q.id, q.elements[0]!.id)).toBe(before);
  });

  it('removes one of several, leaving the other alone', () => {
    const base = doc();
    const seeded = addElement(base, base.questions[0]!.id);
    const q = seeded.questions[0]!;
    const kept = q.elements[0]!;

    const next = removeElement(seeded, q.id, q.elements[1]!.id);

    expect(next.questions[0]!.elements).toEqual([kept]);
  });
});

describe('addAnchor', () => {
  it('trims, and ignores a phrase already on the element', () => {
    const base = written();
    const q = base.questions[0]!;

    const next = addAnchor(base, q.id, q.elements[0]!.id, '  for mange ulykker  ');

    expect(next).toBe(base);
  });

  it('ignores a blank phrase', () => {
    const base = written();
    const q = base.questions[0]!;

    expect(addAnchor(base, q.id, q.elements[0]!.id, '   ')).toBe(base);
  });

  it('appends a new phrase in order', () => {
    const base = written();
    const q = base.questions[0]!;

    const next = addAnchor(base, q.id, q.elements[0]!.id, 'mange ulykker');

    expect(next.questions[0]!.elements[0]!.anchors).toEqual(['for mange ulykker', 'mange ulykker']);
  });
});

describe('removeAnchor', () => {
  it('removes the phrase and leaves the element in place', () => {
    const base = written();
    const q = base.questions[0]!;

    const next = removeAnchor(base, q.id, q.elements[0]!.id, 'for mange ulykker');

    expect(next.questions[0]!.elements).toHaveLength(1);
    expect(next.questions[0]!.elements[0]!.anchors).toEqual([]);
    expect(usableElements(next.questions[0]!)).toHaveLength(0);
  });
});

describe('setSettings', () => {
  it('patches without touching the rest', () => {
    const before = doc();

    const next = setSettings(before, { passRule: 'n', passN: 2 });

    expect(next.settings.passRule).toBe('n');
    expect(next.settings.minWords).toBe(before.settings.minWords);
    expect(next.questions).toBe(before.questions);
  });
});

describe('the envelope', () => {
  it('survives every edit — the save token is not the author’s to change', () => {
    const before = doc();
    const q = before.questions[0]!;

    const next = setSettings(addQuestion(setQuestion(before, q.id, { prompt: 'Hva?' })), {
      progress: false,
    });

    expect(next.updatedAt).toBe(before.updatedAt);
  });
});

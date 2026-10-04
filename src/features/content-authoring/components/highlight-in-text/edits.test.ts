import { describe, expect, it } from 'vitest';

import { HT_MAX_Q, newQuestion } from '@/lib/shared-kernel/highlight-in-text';
import { exercise, spanAt } from '@/lib/shared-kernel/highlight-in-text/fixtures.test-support';

import {
  addQuestion,
  putBack,
  removeQuestion,
  setText,
  setTitle,
  toggleMark,
  type HighlightInTextDocument,
} from './edits';

const doc = (): HighlightInTextDocument => ({
  ...exercise(),
  updatedAt: '2026-10-04T10:00:00.000Z',
  audio: { enabled: false } as unknown as HighlightInTextDocument['audio'],
});

describe('edits keep the envelope', () => {
  it('every wrapper leaves updatedAt and the audio draft where they were', () => {
    const before = doc();
    const results = [
      setTitle(before, 'x'),
      setText(before, before.text + ' Slutt.'),
      removeQuestion(before, 'q2'),
      toggleMark(before, 'q1', 0, 0).ex,
      addQuestion(before).ex,
    ];
    for (const after of results) {
      expect(after.updatedAt).toBe(before.updatedAt);
      expect(after.audio).toBe(before.audio);
    }
  });
});

describe('addQuestion', () => {
  it('names the question it added, so the tab can open on it', () => {
    const { ex, added } = addQuestion(doc());
    expect(added).toBe(ex.questions.at(-1)?.id);
    expect(ex.questions).toHaveLength(3);
  });

  it('adds nothing and names nothing at the ceiling (AC-A3)', () => {
    const full = { ...doc(), questions: Array.from({ length: HT_MAX_Q }, () => newQuestion()) };
    const { ex, added } = addQuestion(full);
    expect(added).toBeNull();
    expect(ex.questions).toHaveLength(HT_MAX_Q);
  });
});

describe('text edits and orphans', () => {
  it('deleting the sentence under a mark makes an orphan with its surface and reason (AC-R3), and putting it back restores both (AC-R4)', () => {
    const before = doc();
    const cut = before.text.replace(
      'Vi tok toget til Bodø, og der gikk vi om bord i hurtigbåten. ',
      '',
    );
    const after = setText(before, cut);
    const orphan = after.orphans.find((o) => o.id === 'gikk');
    expect(orphan).toMatchObject({ qid: 'q1', surface: 'gikk', why: 'gikk — why' });

    const restored = setText(after, before.text);
    const back = putBack(restored, 'gikk');
    expect(back.orphans.find((o) => o.id === 'gikk')).toBeUndefined();
    const span = back.questions[0]!.spans.find((s) => s.id === 'gikk');
    expect(span).toMatchObject({ ...spanAt(before.text, 'gikk'), why: 'gikk — why' });
    expect(back.updatedAt).toBe(before.updatedAt);
  });

  it('removing a question takes its orphans with it (AC-A6)', () => {
    const withOrphan = {
      ...doc(),
      orphans: [{ id: 'o', qid: 'q2', surface: 'hele uka', why: '' }],
    };
    expect(removeQuestion(withOrphan, 'q2').orphans).toEqual([]);
  });
});

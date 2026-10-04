import { renderHook } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import { emptyContent, issues, newSegment, type Issue } from '@/lib/shared-kernel/dictation';

import { useIssueCopy } from './issue-copy';

const wrapper = ({ children }: { children: ReactNode }) => (
  <NextIntlClientProvider locale="en" messages={enMessages}>
    {children}
  </NextIntlClientProvider>
);

// Every code of the type, with the parameters its message reads. If the kernel grows a code
// the copy does not know, the type of this table stops compiling.
const ALL: Record<Issue['code'], Issue> = {
  DICT_NO_TITLE: { code: 'DICT_NO_TITLE', level: 'blocker', step: 1 },
  DICT_CLIP_TOO_LONG: { code: 'DICT_CLIP_TOO_LONG', level: 'warning', step: 1, seconds: 200 },
  DICT_NO_KEY: { code: 'DICT_NO_KEY', level: 'blocker', step: 2 },
  DICT_EMPTY_SEGMENT: { code: 'DICT_EMPTY_SEGMENT', level: 'blocker', step: 2, segmentId: 'a' },
  DICT_SEGMENT_TOO_LONG: {
    code: 'DICT_SEGMENT_TOO_LONG',
    level: 'warning',
    step: 2,
    segmentId: 'a',
    words: 21,
  },
  DICT_SEGMENT_TOO_SHORT: {
    code: 'DICT_SEGMENT_TOO_SHORT',
    level: 'warning',
    step: 2,
    segmentId: 'a',
    words: 1,
  },
  DICT_TIMECODE_MISSING: {
    code: 'DICT_TIMECODE_MISSING',
    level: 'warning',
    step: 2,
    segmentId: 'a',
  },
  DICT_DUPLICATE_SEGMENT: {
    code: 'DICT_DUPLICATE_SEGMENT',
    level: 'warning',
    step: 2,
    segmentId: 'a',
  },
  DICT_TOO_MANY_SEGMENTS: { code: 'DICT_TOO_MANY_SEGMENTS', level: 'warning', step: 2, count: 9 },
  DICT_NO_WHY: { code: 'DICT_NO_WHY', level: 'blocker', step: 3, segmentId: 'a' },
  DICT_NO_FOCUS: { code: 'DICT_NO_FOCUS', level: 'warning', step: 3 },
  DICT_FOCUS_WITHOUT_REASON: {
    code: 'DICT_FOCUS_WITHOUT_REASON',
    level: 'warning',
    step: 3,
    segmentId: 'a',
    focusId: 'f',
  },
  DICT_TRANSCRIPT_ALWAYS: { code: 'DICT_TRANSCRIPT_ALWAYS', level: 'blocker', step: 4 },
  DICT_ONE_PLAY_MANY_SEGMENTS: {
    code: 'DICT_ONE_PLAY_MANY_SEGMENTS',
    level: 'warning',
    step: 4,
    count: 3,
  },
  DICT_NO_RETRY_NO_KEY: { code: 'DICT_NO_RETRY_NO_KEY', level: 'warning', step: 4 },
};

describe('useIssueCopy', () => {
  const seg = { ...newSegment(), id: 'a', text: 'Jeg bor her.' };
  const ex = { ...emptyContent('nb'), segments: [{ ...newSegment(), id: 'z' }, seg] };

  it('has words and a fix for every code the kernel can raise', () => {
    const { result } = renderHook(() => useIssueCopy(ex), { wrapper });
    for (const issue of Object.values(ALL)) {
      expect(result.current.describe(issue), issue.code).not.toMatch(/^Authoring\.|issues\./);
      expect(result.current.fix(issue), issue.code).not.toMatch(/^Authoring\.|fixes\./);
    }
  });

  it('names a segment by its place in the list as it is now', () => {
    const { result } = renderHook(() => useIssueCopy(ex), { wrapper });
    expect(result.current.describe(ALL.DICT_EMPTY_SEGMENT)).toBe(
      'Segment 2 — It is empty. Write the sentence or delete the segment.',
    );
    expect(result.current.describe(ALL.DICT_EMPTY_SEGMENT, { bare: true })).toBe(
      'It is empty. Write the sentence or delete the segment.',
    );
  });

  it('says nothing of a segment that is gone, rather than a wrong number', () => {
    const gone = { ...emptyContent('nb'), segments: [{ ...newSegment(), id: 'z' }] };
    const { result } = renderHook(() => useIssueCopy(gone), { wrapper });
    expect(result.current.describe(ALL.DICT_EMPTY_SEGMENT)).toBe(
      'It is empty. Write the sentence or delete the segment.',
    );
  });

  it('writes its numbers: words, sentences, minutes', () => {
    const { result } = renderHook(() => useIssueCopy(ex), { wrapper });
    expect(result.current.describe(ALL.DICT_SEGMENT_TOO_SHORT, { bare: true })).toBe(
      '1 word is too few to hear a word boundary.',
    );
    expect(result.current.describe(ALL.DICT_TOO_MANY_SEGMENTS)).toMatch(/^9 sentences/);
    expect(result.current.describe(ALL.DICT_CLIP_TOO_LONG)).toMatch(/^The clip is 3:20 long/);
  });

  it('reads a real list from the kernel without a gap', () => {
    const blank = emptyContent('nb');
    const { result } = renderHook(() => useIssueCopy(blank), { wrapper });
    for (const issue of issues(blank)) {
      expect(result.current.describe(issue)).toMatch(/\S/);
    }
  });
});

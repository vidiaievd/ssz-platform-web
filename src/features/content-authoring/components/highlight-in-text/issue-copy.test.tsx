import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it } from 'vitest';

import { loadMessages } from '@/lib/i18n/messages';
import type { Issue } from '@/lib/shared-kernel/highlight-in-text';
import { exercise } from '@/lib/shared-kernel/highlight-in-text/fixtures.test-support';

import { useIssueCopy } from './issue-copy';

/** One issue per code — the type is a union, so a missing code here is a type error. */
const ONE_OF_EACH: Record<Issue['code'], Issue> = {
  HT_NO_TEXT: { code: 'HT_NO_TEXT', level: 'blocker', step: 1 },
  HT_NO_TITLE: { code: 'HT_NO_TITLE', level: 'blocker', step: 1 },
  HT_TEXT_SHORT: { code: 'HT_TEXT_SHORT', level: 'warning', step: 1, words: 12 },
  HT_TEXT_LONG: { code: 'HT_TEXT_LONG', level: 'warning', step: 1, words: 300 },
  HT_ORPHANED_MARKS: { code: 'HT_ORPHANED_MARKS', level: 'blocker', step: 2, count: 2 },
  HT_NO_QUESTIONS: { code: 'HT_NO_QUESTIONS', level: 'blocker', step: 2 },
  HT_QUESTION_NO_PROMPT: {
    code: 'HT_QUESTION_NO_PROMPT',
    level: 'blocker',
    step: 2,
    questionId: 'q2',
  },
  HT_QUESTION_NO_SPANS: {
    code: 'HT_QUESTION_NO_SPANS',
    level: 'blocker',
    step: 2,
    questionId: 'q2',
  },
  HT_SPANS_OVERLAP: { code: 'HT_SPANS_OVERLAP', level: 'blocker', step: 2, questionId: 'q2' },
  HT_SPAN_OFF_TOKENS: {
    code: 'HT_SPAN_OFF_TOKENS',
    level: 'blocker',
    step: 2,
    questionId: 'q2',
    spanId: 's',
  },
  HT_TOO_FEW_SPANS: {
    code: 'HT_TOO_FEW_SPANS',
    level: 'warning',
    step: 2,
    questionId: 'q2',
    count: 2,
  },
  HT_DENSITY_HIGH: {
    code: 'HT_DENSITY_HIGH',
    level: 'warning',
    step: 2,
    questionId: 'q2',
    share: 0.45,
  },
  HT_UNIT_MISMATCH: { code: 'HT_UNIT_MISMATCH', level: 'warning', step: 2, questionId: 'q2' },
  HT_DUPLICATE_PROMPT: { code: 'HT_DUPLICATE_PROMPT', level: 'warning', step: 2, questionId: 'q2' },
  HT_TOO_MANY_QUESTIONS: { code: 'HT_TOO_MANY_QUESTIONS', level: 'warning', step: 2, count: 5 },
  HT_NO_MISS_HINT: { code: 'HT_NO_MISS_HINT', level: 'blocker', step: 3, questionId: 'q2' },
  HT_NO_FP_HINT: { code: 'HT_NO_FP_HINT', level: 'warning', step: 3, questionId: 'q2' },
  HT_PENALTY_OFF: { code: 'HT_PENALTY_OFF', level: 'warning', step: 4 },
  HT_COUNT_SHOWN: { code: 'HT_COUNT_SHOWN', level: 'warning', step: 4 },
  HT_ONE_SHOT_REVEAL: { code: 'HT_ONE_SHOT_REVEAL', level: 'warning', step: 4 },
};

function Lines({ bare }: { bare: boolean }) {
  const copy = useIssueCopy(exercise());
  return (
    <ul>
      {Object.values(ONE_OF_EACH).map((issue) => (
        <li key={issue.code} data-code={issue.code}>
          <span data-part="message">{copy.describe(issue, { bare })}</span>
          <span data-part="fix">{copy.fix(issue)}</span>
        </li>
      ))}
    </ul>
  );
}

async function draw(locale: string, bare = false) {
  const messages = await loadMessages(locale);
  return render(
    <NextIntlClientProvider locale={locale} messages={messages} onError={() => {}}>
      <Lines bare={bare} />
    </NextIntlClientProvider>,
  );
}

const line = (code: string, part: 'message' | 'fix') =>
  document.querySelector(`[data-code="${code}"] [data-part="${part}"]`)?.textContent ?? '';

describe('useIssueCopy', () => {
  it.each(['en', 'nb', 'uk', 'ru'])(
    'has words and a fix for every one of the 20 codes in %s',
    async (locale) => {
      await draw(locale);
      for (const code of Object.keys(ONE_OF_EACH)) {
        expect(line(code, 'message')).not.toMatch(/highlightInText|HT_/);
        expect(line(code, 'message').length).toBeGreaterThan(5);
        expect(line(code, 'fix')).not.toMatch(/highlightInText|HT_/);
      }
    },
  );

  it('names a question by its place in the list, never by counting (deviation 11)', async () => {
    await draw('en');
    expect(line('HT_QUESTION_NO_PROMPT', 'message')).toBe('Question 2 — It has no wording.');
    expect(line('HT_NO_TEXT', 'message')).toBe('There is no text to mark in.');
  });

  it('drops the subject for a line drawn on the question itself', async () => {
    await draw('en', true);
    expect(line('HT_QUESTION_NO_PROMPT', 'message')).toBe('It has no wording.');
  });

  it('carries the numbers the kernel gives', async () => {
    await draw('en');
    expect(line('HT_DENSITY_HIGH', 'message')).toContain('45%');
    expect(line('HT_TEXT_SHORT', 'message')).toContain('12 words');
    expect(line('HT_ORPHANED_MARKS', 'message')).toContain('2 marks lost their place');
    expect(screen.getAllByText('Review the toggles')).toHaveLength(3);
  });
});

import { renderHook } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import {
  emptyContent,
  issues,
  newCriterion,
  newPrompt,
  type Issue,
  type IssueCode,
  type ReadAloudContent,
} from '@/lib/shared-kernel/read-aloud';

import { useIssueCopy } from './issue-copy';

const wrapper = ({ children }: { children: ReactNode }) => (
  <NextIntlClientProvider locale="en" messages={enMessages}>
    {children}
  </NextIntlClientProvider>
);

const copyFor = (content: ReadAloudContent) =>
  renderHook(() => useIssueCopy(content), { wrapper }).result.current;

const find = (list: Issue[], code: IssueCode) => list.find((i) => i.code === code)!;

describe('useIssueCopy', () => {
  it('calls a prompt by its label, and by its place when it has none', () => {
    const base = emptyContent('nb');
    const named = { ...base, prompts: [{ ...newPrompt('read'), id: 'a', label: 'Avsnitt 1' }] };
    const copy = copyFor(named);
    expect(copy.describe(find(issues(named, { audio: true }), 'RA_PROMPT_NO_MATERIAL'))).toMatch(
      /^Avsnitt 1 has no text to read/,
    );

    const anon = { ...base, prompts: [newPrompt('read'), { ...newPrompt('read'), id: 'b' }] };
    const second = issues(anon, { audio: true }).filter((i) => i.code === 'RA_NO_NOTE')[1]!;
    expect(copyFor(anon).describe(second)).toMatch(/^Prompt 2 tells the teacher nothing/);
  });

  it('names the material each mode lacks', () => {
    const base = emptyContent('nb');
    for (const [mode, what] of [
      ['monologue', 'neither a picture nor a plan'],
      ['dialogue', 'no partner line to answer'],
    ] as const) {
      const content = { ...base, mode, prompts: [newPrompt(mode)] };
      expect(
        copyFor(content).describe(find(issues(content, { audio: true }), 'RA_PROMPT_NO_MATERIAL')),
      ).toContain(what);
    }
  });

  it('calls a criterion by its place or its name', () => {
    const base = emptyContent('nb');
    const content = {
      ...base,
      rubric: [
        { ...newCriterion(), id: 'x', name: '' },
        { ...newCriterion(), id: 'y', name: 'Flyt' },
      ],
    };
    const list = issues(content, { audio: true });
    expect(copyFor(content).describe(find(list, 'RA_CRITERION_NO_NAME'))).toBe(
      'Criterion 1 has no name.',
    );
    const level = list.filter((i) => i.code === 'RA_LEVEL_EMPTY')[1]!;
    expect(copyFor(content).describe(level)).toMatch(/^«Flyt» has an empty level descriptor/);
  });

  it('writes lengths as m:ss and the pass mark with its maximum', () => {
    const base = emptyContent('nb');
    const content = {
      ...base,
      prompts: [{ ...newPrompt('read'), id: 'a', text: 'Hei', maxSeconds: 200, minSeconds: 10 }],
      settings: { ...base.settings, passScore: 20 },
    };
    const list = issues(content, { audio: true });
    expect(copyFor(content).describe(find(list, 'RA_OVER_CEILING'))).toBe(
      'Prompt 1 allows 3:20 — over the 3:00 upload ceiling.',
    );
    expect(copyFor(content).describe(find(list, 'RA_PASS_ABOVE_MAX'))).toContain(
      '(20) is above the maximum (15)',
    );
  });

  it('has a sentence and a fix for every code the kernel can raise (RA-B15)', () => {
    const base = emptyContent('nb');
    const everything: ReadAloudContent = {
      ...base,
      prompts: Array.from({ length: 5 }, (_, i) => ({
        ...newPrompt('read'),
        id: `p${i}`,
        text: i === 0 ? Array(100).fill('ord').join(' ') : '',
        maxSeconds: 200,
        minSeconds: 300,
      })),
      rubric: [{ ...newCriterion(), studentVisible: false }],
      settings: { ...base.settings, passScore: 99, showModel: 'never' },
      recording: { ...base.recording, takes: 1, listenBack: false, micCheck: false },
      review: { ...base.review, aiStage: true },
    };
    const copy = copyFor(everything);
    const raised = [
      ...issues(everything, { audio: true }),
      ...issues({ ...everything, prompts: [] }, { audio: false }),
      ...issues({ ...everything, mode: 'dialogue' }, { audio: false }),
      ...issues(
        {
          ...everything,
          mode: 'monologue',
          prompts: [
            {
              ...newPrompt('monologue'),
              plan: Array.from({ length: 6 }, () => ({
                id: Math.random().toString(),
                text: 'x',
                required: true,
              })),
            },
          ],
        },
        { audio: false },
      ),
      ...issues(
        { ...everything, recording: { ...everything.recording, takes: 3, chooseBest: true } },
        { audio: false },
      ),
    ];
    for (const issue of raised) {
      const text = copy.describe(issue);
      expect(text, issue.code).not.toMatch(/^Authoring\.|issues\.RA_|\{|undefined/);
      expect(copy.fix(issue), issue.code).not.toMatch(/^Authoring\.|fixes\.RA_/);
    }
    expect(new Set(raised.map((i) => i.code)).size).toBeGreaterThanOrEqual(18);
  });
});

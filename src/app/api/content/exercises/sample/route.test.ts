// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/api/server-fetcher', () => ({ serverFetch: vi.fn() }));

const { GET } = await import('./route');
import { serverFetch } from '@/lib/api/server-fetcher';

function item(id: string, templateCode: string, content: Record<string, unknown>) {
  return {
    id,
    templateCode,
    content,
    targetLanguage: 'nb',
    difficultyLevel: 'A2',
    instructions: [],
  };
}

/** The old single-question shape the placement runner grades in the browser. */
const OLD_FORM = item('old-1', 'multiple_choice', {
  question: 'Hva heter du?',
  options: [
    { id: 'o1', text: 'Jeg heter Kari' },
    { id: 'o2', text: 'Jeg er Kari' },
  ],
  expected_answers: { correct_option_ids: ['o1'] },
});

/** The set introduced by plan 53: a `questions` array and no question of its own. */
const NEW_FORM = item('set-1', 'multiple_choice', {
  title: '',
  instruction: 'Velg riktig form.',
  questions: [{ id: 'q1', kind: 'grammar', context: '', stem: 'Han ___ i går.', options: [] }],
  settings: {},
});

function request(params: Record<string, string>) {
  const query = new URLSearchParams(params).toString();
  return new NextRequest(`http://localhost/api/content/exercises/sample?${query}`);
}

const BASE = { targetLanguage: 'nb', difficultyLevel: 'A2' };

beforeEach(() => vi.mocked(serverFetch).mockReset());

describe('GET /api/content/exercises/sample', () => {
  it('never hands the placement test a multiple-choice set', async () => {
    vi.mocked(serverFetch).mockResolvedValue({ items: [NEW_FORM, OLD_FORM] });

    // Twenty draws: the pick is random, so a single one proves nothing about a filter.
    for (let i = 0; i < 20; i += 1) {
      const res = await GET(request({ ...BASE, templateCodes: 'multiple_choice' }));
      expect(res.status).toBe(200);
      expect(((await res.json()) as { id: string }).id).toBe('old-1');
    }
  });

  it('404s rather than falling back when every candidate is a set', async () => {
    vi.mocked(serverFetch).mockResolvedValue({ items: [NEW_FORM] });

    const res = await GET(request({ ...BASE, templateCodes: 'multiple_choice' }));

    expect(res.status).toBe(404);
  });

  it('leaves other templates alone — the shape only disqualifies multiple choice', async () => {
    const freeText = item('ft-1', 'free_text', { source_text: 'It rains.', questions: ['ignored'] });
    vi.mocked(serverFetch).mockResolvedValue({ items: [freeText] });

    const res = await GET(request({ ...BASE, templateCodes: 'free_text' }));

    expect(res.status).toBe(200);
    expect(((await res.json()) as { id: string }).id).toBe('ft-1');
  });

  it('still honours excludeIds and the template filter', async () => {
    vi.mocked(serverFetch).mockResolvedValue({ items: [OLD_FORM] });

    const res = await GET(request({ ...BASE, templateCodes: 'multiple_choice', excludeIds: 'old-1' }));

    expect(res.status).toBe(404);
  });
});

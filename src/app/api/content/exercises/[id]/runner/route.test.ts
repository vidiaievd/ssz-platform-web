// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/api/server-fetcher', () => ({ serverFetch: vi.fn() }));

const { GET } = await import('./route');
import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors';

const display = (templateCode: string, content: Record<string, unknown> = {}) => ({
  id: 'ex-1',
  templateCode,
  targetLanguage: 'nb',
  content,
  instructions: null,
});

const request = (query = '') =>
  new NextRequest(`http://localhost/api/content/exercises/ex-1/runner${query}`);

const params = Promise.resolve({ id: 'ex-1' });

beforeEach(() => vi.mocked(serverFetch).mockReset());

describe('GET /api/content/exercises/[id]/runner', () => {
  it('hands the key to a template the browser checks — from the live document', async () => {
    vi.mocked(serverFetch)
      .mockResolvedValueOnce(display('multiple_choice', { question: 'Hvor?' }))
      .mockResolvedValueOnce({
        ...display('multiple_choice', { question: 'Hvor?' }),
        expectedAnswers: { correct_option_id: 'b' },
      });

    const res = await GET(request(), { params });

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      templateCode: 'multiple_choice',
      expectedAnswers: { correct_option_id: 'b' },
    });
    // Never `scope=draft`: an attempt is graded against what the student was served,
    // and an unpublished edit is the editor's business.
    expect(vi.mocked(serverFetch).mock.calls[1]?.[0]).toMatchObject({
      path: '/exercises/ex-1/answers',
    });
  });

  it('withholds the key from a server-graded template, and never asks for it', async () => {
    vi.mocked(serverFetch).mockResolvedValueOnce(
      display('word_bank_gap_fill', { sentences: [{ id: 's1', text: 'Jeg [bor] her.' }] }),
    );

    const res = await GET(request(), { params });

    await expect(res.json()).resolves.toMatchObject({ expectedAnswers: {} });
    expect(serverFetch).toHaveBeenCalledOnce();
    expect(vi.mocked(serverFetch).mock.calls[0]?.[0]).toMatchObject({
      path: '/exercises/ex-1/display',
    });
  });

  it('tells the two short_answer forms apart: the old one gets its accepted strings', async () => {
    vi.mocked(serverFetch)
      .mockResolvedValueOnce(display('short_answer', { question: 'Når?' }))
      .mockResolvedValueOnce({
        ...display('short_answer', { question: 'Når?' }),
        expectedAnswers: { accepted_answers: ['på radio'] },
      });

    const res = await GET(request(), { params });

    await expect(res.json()).resolves.toMatchObject({
      expectedAnswers: { accepted_answers: ['på radio'] },
    });
  });

  it('tells the two short_answer forms apart: the new one keeps its anchors', async () => {
    vi.mocked(serverFetch).mockResolvedValueOnce(
      display('short_answer', { questions: [{ id: 'sa1', prompt: 'Hvor lenge?' }], settings: {} }),
    );

    const res = await GET(request(), { params });

    // The anchors are the answer written in the student's own words; asking for them
    // here would undo the projection the server just made.
    await expect(res.json()).resolves.toMatchObject({ expectedAnswers: {} });
    expect(serverFetch).toHaveBeenCalledOnce();
  });

  it('passes the instruction language through', async () => {
    vi.mocked(serverFetch).mockResolvedValueOnce(display('word_bank_gap_fill'));

    await GET(request('?lang=ru'), { params });

    expect(vi.mocked(serverFetch).mock.calls[0]?.[0]).toMatchObject({ query: { lang: 'ru' } });
  });

  it('maps the errors the caller can act on', async () => {
    const cases: Array<[string, number]> = [
      ['unauthenticated', 401],
      ['not_found', 404],
    ];
    for (const [code, status] of cases) {
      vi.mocked(serverFetch).mockRejectedValueOnce(new AppError(code as 'not_found', 'nope'));
      const res = await GET(request(), { params });
      expect(res.status).toBe(status);
    }
  });

  it('reports a broken upstream as a failure of its own', async () => {
    vi.mocked(serverFetch).mockRejectedValueOnce(new Error('boom'));

    const res = await GET(request(), { params });

    expect(res.status).toBe(502);
  });

  /*
    Plan 56 §3.3. The transcript is what the clip says, so it rides with the key: the
    student projection withheld it, and a browser that already holds the key holds
    nothing more by holding this.
  */
  describe('the transcript of a listening exercise', () => {
    const audio = (transcriptWhen: string) => ({
      audio: {
        enabled: true,
        source: 'asset',
        assetId: 'asset-1',
        title: 'Dialog',
        transcript: 'Hei, jeg har vondt i halsen.',
        translation: 'Hi, my throat hurts.',
        settings: { transcriptWhen },
      },
    });

    it('rides with the key when the teacher chose "after"', async () => {
      vi.mocked(serverFetch)
        .mockResolvedValueOnce(display('multiple_choice', { question: 'Hva?' }))
        .mockResolvedValueOnce({
          ...display('multiple_choice', { question: 'Hva?', ...audio('after') }),
          expectedAnswers: { correct_option_id: 'b' },
        });

      const res = await GET(request(), { params });

      await expect(res.json()).resolves.toMatchObject({
        audioTranscript: {
          transcript: 'Hei, jeg har vondt i halsen.',
          translation: 'Hi, my throat hurts.',
        },
      });
    });

    it('is absent when the document served it already, or never will', async () => {
      for (const when of ['always', 'never']) {
        vi.mocked(serverFetch)
          .mockResolvedValueOnce(display('multiple_choice', { question: 'Hva?' }))
          .mockResolvedValueOnce({
            ...display('multiple_choice', { question: 'Hva?', ...audio(when) }),
            expectedAnswers: {},
          });

        const body = await (await GET(request(), { params })).json();
        expect(body.audioTranscript).toBeUndefined();
      }
    });

    it('is not fetched at all for a template the server grades', async () => {
      // There is no second call to reach for: the engine hands the transcript over with
      // the verdict instead.
      vi.mocked(serverFetch).mockResolvedValueOnce(
        display('word_bank_gap_fill', audio('after')),
      );

      const body = await (await GET(request(), { params })).json();

      expect(body.audioTranscript).toBeUndefined();
      expect(serverFetch).toHaveBeenCalledTimes(1);
    });
  });
});

import { NextRequest, NextResponse } from 'next/server';

import { serverFetch } from '@/lib/api/server-fetcher';
import { isAppError } from '@/lib/errors';
import { gradedInBrowser } from '@/features/student/exercises/lib/grading-side';
import type { ExerciseDisplay, ExerciseWithAnswers } from '@/features/content/types';

/**
 * An exercise as the reader may hold it: the published document, plus the answer key
 * only where the browser is the thing that grades.
 *
 * The reader used to call the authoring route (`/answers?scope=draft`) for all thirteen
 * templates, which had two faults and no upside. It sent the key to the browser for the
 * six templates whose grading was moved to the server *because* their key is the
 * exercise — the missing words, the halves that pair, the mistakes to find, the anchor
 * phrases that are the answer written in the student's own words. And `scope=draft`
 * served the learner an author's unpublished edit: the editor needs that document, a
 * student never does.
 *
 * So the order is inverted. The projection comes first — it is what every learner is
 * entitled to and it is safe by construction — and the key is fetched second, only for
 * a document the browser has to check. `gradedInBrowser` decides, from the template and —
 * for `short_answer` and `multiple_choice`, which each cover two live document shapes —
 * from the shape of the document (plan 51 §8 Q1, plan 53 §3.9).
 *
 * `expectedAnswers` is `{}` rather than absent when nothing is owed, so a caller reads
 * the same shape either way and cannot mistake "withheld" for "not loaded yet".
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lang = request.nextUrl.searchParams.get('lang');

  try {
    const display = await serverFetch<ExerciseDisplay>({
      service: 'content',
      path: `/exercises/${id}/display`,
      ...(lang === null || lang === '' ? {} : { query: { lang } }),
    });

    if (!gradedInBrowser(display.templateCode, display.content)) {
      return NextResponse.json({ ...display, expectedAnswers: {} } satisfies ExerciseWithAnswers);
    }

    // The live document, never the draft: an attempt is graded against what the student
    // was actually served. The content of a browser-graded template is not projected —
    // there is nothing in it to hide — so the two halves belong to the same document.
    const withAnswers = await serverFetch<ExerciseWithAnswers>({
      service: 'content',
      path: `/exercises/${id}/answers`,
    });

    return NextResponse.json({
      ...display,
      expectedAnswers: withAnswers.expectedAnswers ?? {},
    } satisfies ExerciseWithAnswers);
  } catch (e) {
    if (isAppError(e)) {
      if (e.code === 'unauthenticated') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      if (e.code === 'not_found') {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
      }
    }
    return NextResponse.json({ error: 'Failed to fetch exercise' }, { status: 502 });
  }
}

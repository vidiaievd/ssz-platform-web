import 'server-only';

import { NextResponse } from 'next/server';

import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors';

/**
 * Whether the caller may edit this exercise, as content-service sees it.
 *
 * The gate in front of every teacher-side action on an exercise's attempts. Those live in
 * exercise-engine, which holds a user and an exercise and nothing about who owns the
 * course — so the right is established here, with the teacher's own token, before an
 * internal route is opened on their behalf.
 *
 * Returns `true`, or the response to send instead: the refusal is content-service's, and
 * passing its status through keeps "you may not" apart from "it is not there".
 */
export async function mayEditExercise(exerciseId: string): Promise<true | NextResponse> {
  try {
    await serverFetch<{ canEdit: true }>({
      service: 'content',
      path: `/exercises/${exerciseId}/edit-access`,
    });
    return true;
  } catch (e) {
    if (e instanceof AppError && e.code === 'unauthenticated') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (e instanceof AppError && e.code === 'forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (e instanceof AppError && e.code === 'not_found') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Failed to check access' }, { status: 502 });
  }
}

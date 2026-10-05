import { type NextRequest, NextResponse } from 'next/server';

import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors';
import type { DictionaryEntry } from '@/lib/shared-kernel/inflection-table';

/**
 * The course dictionary of this exercise's course, for the inflection-table picker
 * (plan 69 §3.8). `pos` narrows it to the paradigm's part of speech; `lang` picks the gloss
 * language. Entries are passed through as stored — the forms are spelt into slots by the kernel.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { searchParams } = request.nextUrl;

  try {
    const entries = await serverFetch<DictionaryEntry[]>({
      service: 'content',
      path: `/exercises/${id}/dictionary`,
      query: { pos: searchParams.get('pos'), lang: searchParams.get('lang') },
    });
    return NextResponse.json(entries);
  } catch (error) {
    if (error instanceof AppError && error.code === 'forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (error instanceof AppError && error.code === 'unauthenticated') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof AppError && error.code === 'not_found') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    if (error instanceof AppError && error.code === 'validation') {
      return NextResponse.json({ error: 'Bad request' }, { status: 400 });
    }
    return NextResponse.json({ error: 'The dictionary could not be read' }, { status: 502 });
  }
}

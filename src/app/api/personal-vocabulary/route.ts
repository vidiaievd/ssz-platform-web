import { NextRequest, NextResponse } from 'next/server';

import { serverFetch } from '@/lib/api/server-fetcher';

import { errorResponse, readJson } from './respond';

/** The student's own words (content-service `personal-vocabulary`, plan 75). */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  try {
    const words = await serverFetch({
      service: 'content',
      path: '/personal-vocabulary',
      query: {
        translationLanguage: searchParams.get('translationLanguage'),
        targetLanguage: searchParams.get('targetLanguage'),
        status: searchParams.get('status'),
      },
    });
    return NextResponse.json(words);
  } catch (e) {
    return errorResponse(e, 'Failed to load my words');
  }
}

/** Adds a word selected in a text — with the student's translation or without one. */
export async function POST(request: NextRequest) {
  const body = await readJson(request);
  if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  try {
    const result = await serverFetch({
      service: 'content',
      path: '/personal-vocabulary',
      method: 'POST',
      body,
      expectedErrorStatuses: [422],
    });
    return NextResponse.json(result);
  } catch (e) {
    return errorResponse(e, 'Failed to add the word');
  }
}

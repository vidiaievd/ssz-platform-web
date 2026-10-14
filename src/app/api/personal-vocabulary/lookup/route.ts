import { NextRequest, NextResponse } from 'next/server';

import { serverFetch } from '@/lib/api/server-fetcher';

import { errorResponse } from '../respond';

/** What is known about a selected form before it is added: my words and the catalogue. */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  try {
    const result = await serverFetch({
      service: 'content',
      path: '/personal-vocabulary/lookup',
      query: {
        targetLanguage: searchParams.get('targetLanguage'),
        translationLanguage: searchParams.get('translationLanguage'),
        form: searchParams.get('form'),
      },
      expectedErrorStatuses: [422],
    });
    return NextResponse.json(result);
  } catch (e) {
    return errorResponse(e, 'Failed to look the word up');
  }
}

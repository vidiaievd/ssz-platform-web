import { NextRequest, NextResponse } from 'next/server';

import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors';
import type { LessonVariant } from '@/features/content/types';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { searchParams } = request.nextUrl;
  // studentNativeLanguage/studentCurrentLevel are required by the backend —
  // callers must currently supply them (no student-profile lookup wired up yet).
  const studentNativeLanguage = searchParams.get('nativeLanguage');
  const studentCurrentLevel = searchParams.get('level');
  if (!studentNativeLanguage || !studentCurrentLevel) {
    return NextResponse.json(
      { error: 'nativeLanguage and level query params are required' },
      { status: 400 },
    );
  }

  try {
    const data = await serverFetch<{ variant: LessonVariant; fallbackUsed: boolean }>({
      service: 'content',
      path: `/lessons/${id}/variants/best`,
      query: { studentNativeLanguage, studentCurrentLevel },
    });
    return NextResponse.json(data.variant);
  } catch (e) {
    if (e instanceof AppError && e.code === 'not_found') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Failed to fetch lesson variant' }, { status: 502 });
  }
}

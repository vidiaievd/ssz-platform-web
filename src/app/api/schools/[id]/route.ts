import { NextRequest, NextResponse } from 'next/server';

import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors';
import { getMySchools } from '@/features/school/api/get-my-schools';

type Params = { params: Promise<{ id: string }> };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    const data = await serverFetch({ service: 'organization', path: `/schools/${id}` });
    return NextResponse.json(data);
  } catch (e) {
    if (e instanceof AppError && e.code === 'unauthenticated') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (e instanceof AppError && e.code === 'forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (e instanceof AppError && e.code === 'not_found' && !UUID_RE.test(id)) {
      // id is a slug — resolve by searching the user's schools list
      const schools = await getMySchools();
      const school = schools.find((s) => s.slug === id);
      if (school) return NextResponse.json(school);
    }
    if (e instanceof AppError && e.code === 'not_found') {
      return NextResponse.json({ error: 'School not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Failed to fetch school' }, { status: 502 });
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  try {
    await serverFetch({
      service: 'organization',
      path: `/schools/${id}`,
      method: 'PATCH',
      body,
    });
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    if (e instanceof AppError && e.code === 'unauthenticated') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (e instanceof AppError && e.code === 'forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (e instanceof AppError && e.code === 'conflict') {
      return NextResponse.json({ error: 'School name already taken' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Failed to update school' }, { status: 502 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    await serverFetch({
      service: 'organization',
      path: `/schools/${id}`,
      method: 'DELETE',
    });
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    if (e instanceof AppError && e.code === 'unauthenticated') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (e instanceof AppError && e.code === 'forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Failed to delete school' }, { status: 502 });
  }
}

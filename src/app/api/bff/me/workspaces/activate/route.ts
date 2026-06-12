import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

const LAST_WORKSPACE_COOKIE = 'last-workspace';
const ONE_YEAR = 60 * 60 * 24 * 365;

const ActivateSchema = z.object({ contextKey: z.string().min(1) });

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = ActivateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'contextKey is required' }, { status: 422 });
  }

  const jar = await cookies();
  jar.set(LAST_WORKSPACE_COOKIE, parsed.data.contextKey, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: ONE_YEAR,
  });

  return new NextResponse(null, { status: 204 });
}

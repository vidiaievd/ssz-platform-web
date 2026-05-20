import { NextResponse } from 'next/server';

import { getCurrentUser } from '@/features/auth/api/get-current-user';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return new NextResponse(null, { status: 204 });
  return NextResponse.json(user);
}

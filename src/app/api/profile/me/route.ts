import { NextResponse } from 'next/server';

import { getMyProfile } from '@/features/profile/api/get-my-profile';

export async function GET() {
  const profile = await getMyProfile();
  if (!profile) return new NextResponse(null, { status: 204 });
  return NextResponse.json(profile);
}

import { NextResponse } from 'next/server';

import type { ActivityStreak } from '@/features/student/types';

// Stub data until the Progress service exposes streak data.
export const MOCK_STREAK: ActivityStreak = {
  currentStreak: 4,
  longestStreak: 12,
  totalActiveDays: 31,
  lastActivityAt: new Date(Date.now() - 18 * 60 * 60 * 1000).toISOString(),
};

export async function GET() {
  return NextResponse.json(MOCK_STREAK);
}

import { NextRequest, NextResponse } from 'next/server';
import { isAppError } from '@/lib/errors';
import { getEnrollmentProvider } from '@/lib/enrollment/provider';
import { resolveOnboardingSettings } from '@/lib/enrollment/settings-defaults';

type Params = { params: Promise<{ schoolSlug: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { schoolSlug } = await params;
  try {
    const provider = getEnrollmentProvider();
    const settings = await provider.getSchoolSettings(schoolSlug);
    return NextResponse.json(settings);
  } catch (e) {
    if (isAppError(e)) return NextResponse.json({ error: e.message }, { status: 502 });
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 502 });
  }
}

export async function PUT(req: NextRequest, { params }: Params) {
  const { schoolSlug } = await params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  try {
    const provider = getEnrollmentProvider();
    // Merge submitted partial settings with defaults for safety
    const merged = resolveOnboardingSettings(
      body as Partial<import('@/features/enrollment/types').SchoolOnboardingSettings>,
    );
    const saved = await provider.saveSchoolSettings(schoolSlug, merged);
    return NextResponse.json(saved);
  } catch (e) {
    if (isAppError(e)) return NextResponse.json({ error: e.message }, { status: 502 });
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 502 });
  }
}

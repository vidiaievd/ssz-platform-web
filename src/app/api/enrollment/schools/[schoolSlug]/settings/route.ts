import { NextRequest, NextResponse } from 'next/server';

import { serverFetch } from '@/lib/api/server-fetcher';
import { isAppError } from '@/lib/errors';
import { resolveOnboardingSettings } from '@/lib/enrollment/settings-defaults';
import { resolveSchoolWorkspace } from '@/features/workspaces/api/resolve-school-workspace';
import type { SchoolOnboardingSettings, PlacementMode } from '@/features/enrollment/types';

type Params = { params: Promise<{ schoolSlug: string }> };

type BackendSettings = {
  placementMode: string;
  schoolTestId?: string;
  reusePlatform: boolean;
  maxResultAgeDays?: number;
  interviewRequired: boolean;
  autoPlaceByScore: boolean;
  collectAvailability: boolean;
  ageBands: string[];
  collectAgeBand: boolean;
  approvalMode: string;
};

function toFrontend(dto: BackendSettings): SchoolOnboardingSettings {
  return {
    placement: {
      mode: dto.placementMode as PlacementMode,
      schoolTestId: dto.schoolTestId,
      reusePlatformResult: dto.reusePlatform,
      maxResultAgeDays: dto.maxResultAgeDays,
    },
    interview: {
      required: dto.interviewRequired,
      autoPlaceByScore: dto.autoPlaceByScore,
    },
    availability: { collect: dto.collectAvailability },
    ageBands: { values: dto.ageBands as SchoolOnboardingSettings['ageBands']['values'], collect: dto.collectAgeBand },
    approval: { mode: dto.approvalMode as 'auto' | 'manual' },
  };
}

function toBackend(s: SchoolOnboardingSettings): BackendSettings {
  return {
    placementMode: s.placement.mode,
    schoolTestId: s.placement.schoolTestId,
    reusePlatform: s.placement.reusePlatformResult,
    maxResultAgeDays: s.placement.maxResultAgeDays,
    interviewRequired: s.interview.required,
    autoPlaceByScore: s.interview.autoPlaceByScore,
    collectAvailability: s.availability.collect,
    ageBands: s.ageBands.values,
    collectAgeBand: s.ageBands.collect,
    approvalMode: s.approval.mode,
  };
}

/** The school behind a workspace id or slug; null when it is not the caller's school. */
async function resolveSchoolId(idOrSlug: string): Promise<string | null> {
  return (await resolveSchoolWorkspace(idOrSlug))?.id ?? null;
}

const notFound = () => NextResponse.json({ error: 'School not found' }, { status: 404 });

export async function GET(_req: NextRequest, { params }: Params) {
  const { schoolSlug } = await params;
  try {
    const schoolId = await resolveSchoolId(schoolSlug);
    if (!schoolId) return notFound();
    const dto = await serverFetch<BackendSettings>({
      service: 'organization',
      path: `/schools/${schoolId}/enrollment/settings`,
    });
    return NextResponse.json(toFrontend(dto));
  } catch (e) {
    if (isAppError(e)) {
      if (e.code === 'not_found') return NextResponse.json(resolveOnboardingSettings(), { status: 200 });
      return NextResponse.json({ error: e.message }, { status: 502 });
    }
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
    const schoolId = await resolveSchoolId(schoolSlug);
    if (!schoolId) return notFound();
    const merged = resolveOnboardingSettings(
      body as Partial<SchoolOnboardingSettings>,
    );
    const dto = await serverFetch<BackendSettings>({
      service: 'organization',
      path: `/schools/${schoolId}/enrollment/settings`,
      method: 'PUT',
      body: toBackend(merged),
    });
    return NextResponse.json(toFrontend(dto));
  } catch (e) {
    if (isAppError(e)) return NextResponse.json({ error: e.message }, { status: 502 });
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 502 });
  }
}

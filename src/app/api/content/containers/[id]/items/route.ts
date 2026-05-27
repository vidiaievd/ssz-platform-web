import { NextRequest, NextResponse } from 'next/server';

import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors';
import type { ContainerItem, Container, ContainerVersion } from '@/features/content/types';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { searchParams } = request.nextUrl;
  let versionId = searchParams.get('versionId');
  const draft = searchParams.get('draft') === 'true';

  try {
    if (!versionId) {
      if (draft) {
        const versions = await serverFetch<ContainerVersion[]>({
          service: 'content',
          path: `/containers/${id}/versions`,
        });
        const draftVersion = versions.find((v) => !v.isPublished) ?? versions[0];
        versionId = draftVersion?.id ?? null;
      } else {
        const container = await serverFetch<Container>({
          service: 'content',
          path: `/containers/${id}`,
        });
        versionId = container.publishedVersionId ?? null;
      }
    }

    if (!versionId) {
      return NextResponse.json([], { status: 200 });
    }

    const items = await serverFetch<ContainerItem[]>({
      service: 'content',
      path: `/containers/${id}/versions/${versionId}/items`,
    });
    return NextResponse.json(items);
  } catch (e) {
    if (e instanceof AppError && e.code === 'not_found') {
      return NextResponse.json([], { status: 200 });
    }
    return NextResponse.json({ error: 'Failed to fetch container items' }, { status: 502 });
  }
}

import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors';
import type { Container, ContainerItem, ContainerVersion, CurriculumTree } from '@/features/content/types';
import { deriveContainerState } from '@/features/content-authoring/components/container-state-badge';
import { LessonEditorShell } from '@/features/content-authoring/components/lesson-editor-shell';
import { EditorBodyPlaceholder } from '@/features/content-authoring/components/editor-body-placeholder';
import { PublishDialog } from '@/features/content-authoring/components/publish-dialog';
import { runPreflight } from '@/features/content-authoring/lib/preflight';
import { findItemSelection } from '@/features/content-authoring/lib/find-tree-item';
import { getMaterialKind } from '@/features/content-authoring/lib/material-kind';
import type { PreflightResult } from '@/features/content-authoring/types';

export default async function LessonEditorPage({
  params,
}: {
  params: Promise<{ schoolSlug: string; id: string; itemId: string }>;
}) {
  const { schoolSlug, id, itemId } = await params;
  const t = await getTranslations('Authoring');

  let container: Container;
  try {
    container = await serverFetch<Container>({
      service: 'content',
      path: `/containers/${id}`,
    });
  } catch (e) {
    if (e instanceof AppError && e.code === 'not_found') notFound();
    throw e;
  }

  const state = deriveContainerState(container);

  const versionsResp = await serverFetch<{ items: ContainerVersion[] }>({
    service: 'content',
    path: `/containers/${id}/versions`,
  });
  const draftVersion = versionsResp.items.find((v) => v.status === 'draft');
  if (!draftVersion) notFound();

  const tree = await serverFetch<CurriculumTree>({
    service: 'content',
    path: `/containers/${id}/versions/${draftVersion.id}/tree`,
  });
  const selection = findItemSelection(tree, itemId);
  if (!selection || selection.kind !== 'item') notFound();
  const { item } = selection;

  let preflight: PreflightResult | undefined;
  if (state === 'draft') {
    const items = await serverFetch<ContainerItem[]>({
      service: 'content',
      path: `/containers/${id}/versions/${draftVersion.id}/items`,
    });
    preflight = runPreflight(schoolSlug, container, items);
  }

  const kind = getMaterialKind(item);

  return (
    <main className="mx-auto max-w-7xl p-8">
      <LessonEditorShell
        kind={kind}
        title={item.title ?? t('lessons.untitled')}
        state={item.state}
        backHref={`/school/${schoolSlug}/content/${id}`}
        autosaveStatus="idle"
        autosaveSavedAt={null}
        publishSlot={<PublishDialog container={container} result={preflight} />}
        preview={<EditorBodyPlaceholder kind={kind} variant="preview" />}
      >
        <EditorBodyPlaceholder kind={kind} variant="body" />
      </LessonEditorShell>
    </main>
  );
}

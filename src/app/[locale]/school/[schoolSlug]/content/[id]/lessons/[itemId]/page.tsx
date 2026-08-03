import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors';
import { Breadcrumbs, type BreadcrumbItem } from '@/components/shared/breadcrumbs';
import { Button } from '@/components/ui/button';
import { Link } from '@/lib/i18n/navigation';
import type { Container, ContainerVersion, CurriculumTree } from '@/features/content/types';
import { TextEditorPane } from '@/features/content-authoring/components/text-editor-pane';
import { VideoEditorPane } from '@/features/content-authoring/components/video-editor-pane';
import { AudioEditorPane } from '@/features/content-authoring/components/audio-editor-pane';
import { LiveEditorPane } from '@/features/content-authoring/components/live-editor-pane';
import { VocabularyEditorPane } from '@/features/content-authoring/components/vocabulary-editor-pane';
import { GrammarEditorPane } from '@/features/content-authoring/components/grammar-editor-pane';
import { ExerciseEditorPane } from '@/features/content-authoring/components/exercise-editor-pane';
import { findItemWithModule } from '@/features/content-authoring/lib/find-tree-item';
import { collectLevelGrammarRules } from '@/features/content-authoring/lib/level-grammar-rules';
import { getMaterialKind } from '@/features/content-authoring/lib/material-kind';

export default async function LessonEditorPage({
  params,
}: {
  params: Promise<{ schoolSlug: string; id: string; itemId: string }>;
}) {
  const { schoolSlug, id, itemId } = await params;

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
  const found = findItemWithModule(tree, itemId);
  if (!found) notFound();
  const { item, sectionTitle, levelTitle, moduleContainerId } = found;

  let moduleContainer: Container;
  try {
    moduleContainer = await serverFetch<Container>({
      service: 'content',
      path: `/containers/${moduleContainerId}`,
    });
  } catch (e) {
    if (e instanceof AppError && e.code === 'not_found') notFound();
    throw e;
  }

  const kind = getMaterialKind(item);
  // Annotating grammar in a text points at the rules of its own Leksjon; the
  // tree above already holds them, so the editor needs no request of its own.
  const levelGrammarRules = collectLevelGrammarRules(tree, moduleContainerId);
  const backHref = `/school/${schoolSlug}/content/${id}`;
  const t = await getTranslations('Authoring');
  // Deliberately not a publish button: students read the *module's* published
  // version, so publishing the course from here changed nothing for this
  // lesson. Releasing happens in one place, against the whole course.
  const publishSlot = (
    <Button asChild variant="outline" size="sm">
      <Link href={`${backHref}?publish=1`}>{t('reviewPublish.trigger')}</Link>
    </Button>
  );

  const sectionCrumb =
    levelTitle && sectionTitle ? `${levelTitle} · ${sectionTitle}` : (levelTitle ?? sectionTitle);
  const breadcrumbItems: BreadcrumbItem[] = [
    { label: t('breadcrumb.courses'), href: `/school/${schoolSlug}/content` },
    { label: container.title, href: backHref },
    ...(sectionCrumb ? [{ label: sectionCrumb }] : []),
    { label: item.title ?? t('lessons.untitled') },
  ];

  return (
    <main className="mx-auto max-w-7xl p-8">
      <Breadcrumbs items={breadcrumbItems} className="mb-5" />
      {kind === 'text' ? (
        <TextEditorPane
          kind={kind}
          lessonId={item.refId}
          lessonTitle={item.title}
          state={item.state}
          isLive={item.isLive}
          container={moduleContainer}
          grammarRules={levelGrammarRules}
          backHref={backHref}
          publishSlot={publishSlot}
        />
      ) : kind === 'video' ? (
        <VideoEditorPane
          kind={kind}
          lessonId={item.refId}
          lessonTitle={item.title}
          state={item.state}
          isLive={item.isLive}
          container={moduleContainer}
          backHref={backHref}
          publishSlot={publishSlot}
        />
      ) : kind === 'audio' ? (
        <AudioEditorPane
          kind={kind}
          lessonId={item.refId}
          lessonTitle={item.title}
          state={item.state}
          isLive={item.isLive}
          container={moduleContainer}
          backHref={backHref}
          publishSlot={publishSlot}
        />
      ) : kind === 'vocab' ? (
        <VocabularyEditorPane
          kind={kind}
          lessonTitle={item.title}
          state={item.state}
          isLive={item.isLive}
          container={moduleContainer}
          backHref={backHref}
          publishSlot={publishSlot}
        />
      ) : kind === 'grammar' ? (
        <GrammarEditorPane
          kind={kind}
          ruleId={item.refId}
          ruleTitle={item.title}
          state={item.state}
          isLive={item.isLive}
          container={moduleContainer}
          backHref={backHref}
          publishSlot={publishSlot}
        />
      ) : kind === 'exercise' ? (
        <ExerciseEditorPane
          kind={kind}
          exerciseId={item.refId}
          lessonTitle={item.title}
          state={item.state}
          isLive={item.isLive}
          container={moduleContainer}
          backHref={backHref}
          publishSlot={publishSlot}
        />
      ) : (
        <LiveEditorPane
          kind={kind}
          lessonId={item.refId}
          lessonTitle={item.title}
          state={item.state}
          isLive={item.isLive}
          container={moduleContainer}
          backHref={backHref}
          publishSlot={publishSlot}
        />
      )}
    </main>
  );
}

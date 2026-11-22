import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors';
import type { BreadcrumbItem } from '@/components/shared/breadcrumbs';
import { Button } from '@/components/ui/button';
import { Link } from '@/lib/i18n/navigation';
import type { Container, ContainerVersion, CurriculumTree } from '@/features/content/types';
import { TopbarBreadcrumb } from '@/features/content-authoring/components/topbar-breadcrumb';
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
import { wsHref } from '@/features/workspaces/lib/href';
import { NoAccess } from '@/features/content-authoring/components/no-access';
import {
  CourseReadOnlyNotice,
  CourseReadOnlyProvider,
} from '@/features/content-authoring/components/course-read-only';
import { canEditContainer } from '@/features/content-authoring/lib/get-container-edit-access';

export default async function LessonEditorPage({
  params,
}: {
  params: Promise<{ workspaceId: string; id: string; itemId: string }>;
}) {
  const { workspaceId, id, itemId } = await params;

  let container: Container;
  try {
    container = await serverFetch<Container>({
      service: 'content',
      path: `/containers/${id}`,
    });
  } catch (e) {
    if (e instanceof AppError && e.code === 'not_found') notFound();
    // Somebody else's course is not a broken platform.
    if (e instanceof AppError && e.code === 'forbidden') return <NoAccess />;
    throw e;
  }

  // Not allowed to edit the course — the lesson opens for viewing (plan 90, Q17 (a)).
  const readOnly = !(await canEditContainer(id));

  const versionsResp = await serverFetch<{ items: ContainerVersion[] }>({
    service: 'content',
    path: `/containers/${id}/versions`,
  });
  // A viewer of a course without a draft reads the published version, as on the course page.
  const treeVersionId =
    versionsResp.items.find((v) => v.status === 'draft')?.id ??
    (readOnly ? container.currentPublishedVersionId : null);
  if (!treeVersionId) notFound();

  const tree = await serverFetch<CurriculumTree>({
    service: 'content',
    path: `/containers/${id}/versions/${treeVersionId}/tree`,
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
  const backHref = wsHref(workspaceId, `content/${id}`);
  const t = await getTranslations('Authoring');
  // Deliberately not a publish button: students read the *module's* published
  // version, so publishing the course from here changed nothing for this
  // lesson. Releasing happens in one place, against the whole course.
  const publishSlot = readOnly ? null : (
    <Button asChild variant="outline" size="sm">
      <Link href={`${backHref}?publish=1`}>{t('reviewPublish.trigger')}</Link>
    </Button>
  );

  const sectionCrumb =
    levelTitle && sectionTitle ? `${levelTitle} · ${sectionTitle}` : (levelTitle ?? sectionTitle);
  const breadcrumbItems: BreadcrumbItem[] = [
    { label: t('breadcrumb.courses'), href: wsHref(workspaceId, 'content') },
    { label: container.title, href: backHref },
    ...(sectionCrumb ? [{ label: sectionCrumb }] : []),
    { label: item.title ?? t('lessons.untitled') },
  ];

  return (
    // Full height and full width: the editor is a workspace, not an article. The
    // padding lives on the columns inside `LessonEditorShell`, because its preview
    // panel has to reach the right edge of the window — a container that pads both
    // sides would spend that width on nothing.
    <div className="flex h-full min-h-0 flex-col">
      {/* Into the app's top bar, where the specs put it. */}
      <TopbarBreadcrumb items={breadcrumbItems} />
      <CourseReadOnlyProvider readOnly={readOnly}>
      <CourseReadOnlyNotice className="mx-4 mt-4 md:mx-6" />
      {/* A disabled fieldset switches off every field and save button of the editor at once. */}
      <fieldset disabled={readOnly} className="contents">
      {kind === 'text' ? (
        <TextEditorPane
          kind={kind}
          lessonId={item.refId}
          lessonTitle={item.title}
          state={item.state}
          isLive={item.isLive}
          container={moduleContainer}
          grammarRules={levelGrammarRules}
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
          publishSlot={publishSlot}
        />
      ) : kind === 'vocab' ? (
        <VocabularyEditorPane
          kind={kind}
          lessonTitle={item.title}
          state={item.state}
          isLive={item.isLive}
          container={moduleContainer}
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
          grammarRules={levelGrammarRules}
          reviewHref={wsHref(workspaceId, `review?course=${id}`)}
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
          publishSlot={publishSlot}
        />
      )}
      </fieldset>
      </CourseReadOnlyProvider>
    </div>
  );
}

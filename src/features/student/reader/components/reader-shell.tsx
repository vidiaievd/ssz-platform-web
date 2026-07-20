'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';

import {
  ErrorState,
  LearningSkeleton,
  useCourseHome,
  useUnitContents,
  useUpsertProgress,
} from '@/features/learning';
import { LANG_EMOJI } from '@/features/student/course-home';

import { ContentsSidebar } from './contents-sidebar';
import { ReaderTopBar } from './reader-top-bar';
import { LessonFooterNav } from './lesson-footer-nav';
import { VocabularyPage } from './vocabulary-page';
import { TextLessonPage } from './text-lesson-page';
import { VideoLessonPage } from './video-lesson-page';
import { ListeningLessonPage } from './listening-lesson-page';
import { GrammarLessonPage } from './grammar-lesson-page';
import { LiveLessonPage } from './live-lesson-page';
import { ExercisePage } from './exercise-page';
import {
  flattenSections,
  mapCourseUnitsToSidebarUnits,
  mapContentItemKind,
  mapUnitContentsToSections,
} from '../lib/map-reader-data';

export interface ReaderShellProps {
  courseId: string;
  unitId: string;
  itemId: string;
  children: ReactNode;
  footer?: boolean;
  maxWidth?: number;
  /** Fired when the learner activates the footer "Next" link. */
  onNextItem?: () => void;
}

export function ReaderShell({
  courseId,
  unitId,
  itemId,
  children,
  footer = true,
  maxWidth,
  onNextItem,
}: ReaderShellProps) {
  const t = useTranslations('Learning.reader.sidebar');
  const [collapsed, setCollapsed] = useState(false);

  const courseHome = useCourseHome(courseId);
  const unitContents = useUnitContents(unitId);
  const upsertProgress = useUpsertProgress(courseId, unitId);

  const startedAtRef = useRef<number>(undefined);
  useEffect(() => {
    startedAtRef.current = Date.now();
  }, [itemId]);

  const isLoading = courseHome.isLoading || unitContents.isLoading;
  const isError = courseHome.isError || unitContents.isError;

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-(--ssz-bg-base)">
        <LearningSkeleton variant="list" rows={5} className="w-80" />
      </div>
    );
  }

  if (isError || !courseHome.data || !unitContents.data) {
    return (
      <div className="flex h-screen items-center justify-center bg-(--ssz-bg-base)">
        <ErrorState
          onRetry={() => {
            courseHome.refetch();
            unitContents.refetch();
          }}
        />
      </div>
    );
  }

  const { courseInfo, units, progress } = courseHome.data;
  const contents = unitContents.data;

  const formatMinutes = (minutes: number) => t('durationMinutes', { n: minutes });
  const activeUnitSections = mapUnitContentsToSections(contents, courseId, formatMinutes, t('otherItems'));
  const sidebarUnits = mapCourseUnitsToSidebarUnits(units, unitId, activeUnitSections);
  const flatItems = flattenSections(activeUnitSections);
  const activeItem = flatItems.find((i) => i.id === itemId);

  const allContentItems = [...contents.sections.flatMap((s) => s.items), ...contents.ungroupedItems];
  const activeContentItem = allContentItems.find((i) => i.id === itemId);
  const activeKind = activeContentItem
    ? mapContentItemKind(activeContentItem.contentType, activeContentItem.lessonKind)
    : 'text';
  const activeTitle = activeContentItem?.title ?? activeItem?.title ?? '';

  const activeUnit = units.find((u) => u.id === unitId);
  const moduleVocabularyListId = allContentItems.find((i) => i.contentType === 'VOCABULARY_LIST')?.contentId;

  function handleNext() {
    if (activeContentItem && activeContentItem.status !== 'completed') {
      const timeSpentSeconds = Math.max(
        0,
        Math.round((Date.now() - (startedAtRef.current ?? Date.now())) / 1000),
      );
      upsertProgress.mutate({
        contentType: activeContentItem.contentType,
        contentId: activeContentItem.contentId,
        timeSpentSeconds,
        completed: true,
      });
    }
    onNextItem?.();
  }

  let content: ReactNode = children;
  if (activeKind === 'vocab' && activeContentItem) {
    content = (
      <VocabularyPage
        vocabularyListId={activeContentItem.contentId}
        cefrLevel={courseInfo.cefrLevel}
        unitPosition={activeUnit?.position ?? 0}
        courseTitle={courseInfo.title}
        srsVocabDue={courseHome.data.srsVocabDue}
        siblingItems={flatItems}
        currentItemId={itemId}
      />
    );
  } else if (activeKind === 'text' && activeContentItem) {
    content = (
      <TextLessonPage
        lessonId={activeContentItem.contentId}
        vocabularyListId={moduleVocabularyListId}
        unitPosition={activeUnit?.position ?? 0}
        courseTitle={courseInfo.title}
        cefrLevel={courseInfo.cefrLevel}
      />
    );
  } else if (activeKind === 'video' && activeContentItem) {
    content = (
      <VideoLessonPage
        lessonId={activeContentItem.contentId}
        vocabularyListId={moduleVocabularyListId}
        unitPosition={activeUnit?.position ?? 0}
        courseTitle={courseInfo.title}
        cefrLevel={courseInfo.cefrLevel}
      />
    );
  } else if (activeKind === 'audio' && activeContentItem) {
    content = (
      <ListeningLessonPage
        lessonId={activeContentItem.contentId}
        unitPosition={activeUnit?.position ?? 0}
        courseTitle={courseInfo.title}
        cefrLevel={courseInfo.cefrLevel}
      />
    );
  } else if (activeKind === 'grammar' && activeContentItem) {
    content = (
      <GrammarLessonPage
        ruleId={activeContentItem.contentId}
        unitPosition={activeUnit?.position ?? 0}
        courseTitle={courseInfo.title}
        cefrLevel={courseInfo.cefrLevel}
      />
    );
  } else if (activeKind === 'live' && activeContentItem) {
    content = (
      <LiveLessonPage
        lessonId={activeContentItem.contentId}
        unitPosition={activeUnit?.position ?? 0}
        courseTitle={courseInfo.title}
      />
    );
  } else if (activeKind === 'exercise' && activeContentItem) {
    // key: remount per item so the solver's per-exercise state resets.
    content = <ExercisePage key={activeContentItem.contentId} exerciseId={activeContentItem.contentId} />;
  }
  const effectiveMaxWidth =
    maxWidth ?? (activeKind === 'vocab' ? 780 : activeKind === 'video' ? 880 : 680);

  return (
    <div className="flex h-screen overflow-hidden">
      <ContentsSidebar
        course={{
          title: courseInfo.title,
          flag: LANG_EMOJI[courseInfo.targetLanguage],
          subtitle: [courseInfo.schoolName, courseInfo.groupName].filter(Boolean).join(' · ') || undefined,
          percentComplete: progress.percentComplete,
          itemsDone: progress.completedLessons,
          itemsTotal: progress.totalLessons,
        }}
        units={sidebarUnits}
        activeItemId={itemId}
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed((c) => !c)}
      />
      <main className="flex flex-1 flex-col overflow-hidden bg-(--ssz-bg-base)">
        <ReaderTopBar
          courseHref={`/student/courses/${courseId}`}
          unitPosition={activeUnit?.position ?? 0}
          itemKind={activeKind}
          itemTitle={activeTitle}
        />
        <div className="flex flex-1 flex-col overflow-auto">
          <div className="mx-auto w-full flex-1 px-8 py-8" style={{ maxWidth: effectiveMaxWidth }}>
            {content}
          </div>
          {footer && <LessonFooterNav items={flatItems} activeItemId={itemId} onNext={handleNext} />}
        </div>
      </main>
    </div>
  );
}

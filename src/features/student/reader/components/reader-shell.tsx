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

import { cn } from '@/lib/utils';

import { ContentsSidebar } from './contents-sidebar';
import { ReaderRailProvider, useReaderRailHost } from './reader-rail';
import { TEXT_WIDTH_PX, useReadingModeStore } from '../stores/reading-mode-store';
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
  // Destructured, not held as one object: passing `rail.setContainer` to a
  // `ref` makes the compiler treat the whole object as a ref, and reading
  // `rail.occupied` during render then trips its refs rule.
  const { value: railValue, setContainer: setRailContainer, occupied: railOccupied } =
    useReaderRailHost();
  const textWidth = useReadingModeStore((s) => s.textWidth);

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
      <div className="flex h-full items-center justify-center bg-(--ssz-bg-base)">
        <LearningSkeleton variant="list" rows={5} className="w-80" />
      </div>
    );
  }

  if (isError || !courseHome.data || !unitContents.data) {
    return (
      <div className="flex h-full items-center justify-center bg-(--ssz-bg-base)">
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
        status={activeContentItem.status}
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
  // Only prose is reader-adjustable: the other kinds are laid out around media
  // and cards, where width is a design decision rather than a reading-comfort one.
  const effectiveMaxWidth =
    maxWidth ??
    (activeKind === 'vocab'
      ? 780
      : activeKind === 'video'
        ? 880
        : activeKind === 'text'
          ? TEXT_WIDTH_PX[textWidth]
          : 680);

  return (
    /*
      h-full, not h-screen: this renders inside AppShell's <main>, which is
      already a scroll area sized to the viewport minus the topbar. A second
      full viewport height in there made the shell overflow its container by
      exactly the topbar's height — the outer scrollbar that pushed the footer
      nav below the fold no matter how the footer itself was positioned.
    */
    <div className="flex h-full overflow-hidden">
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
        <ReaderRailProvider value={railValue}>
          <div className="flex flex-1 overflow-hidden">
            {/*
              The scroll lives on the inner div, not on this column, so the
              footer nav below it is pinned to the viewport instead of sitting
              at the end of the prose. On a six-minute text "next" was several
              screens down; the reader had to scroll past everything to leave
              the page even when they were done reading.
            */}
            <div className="flex min-w-0 flex-1 flex-col">
              <div className="flex-1 overflow-auto">
                <div className="mx-auto w-full px-8 py-8" style={{ maxWidth: effectiveMaxWidth }}>
                  {content}
                </div>
              </div>
              {footer && (
                <LessonFooterNav items={flatItems} activeItemId={itemId} onNext={handleNext} />
              )}
            </div>
            {/*
              Always mounted, never conditionally rendered: it is the portal
              target, so a page's rail slot would have nowhere to go on the
              render that decides whether the column is occupied.
            */}
            <aside
              ref={setRailContainer}
              aria-label={t('railLabel')}
              className={cn(
                'shrink-0 overflow-y-auto border-l border-(--ssz-border-default) bg-surface',
                // 352px, and 384px once there is room to spare. The prose column
                // is capped by `effectiveMaxWidth` and centred, so on a wide
                // screen the extra width comes out of empty margin rather than
                // out of the measure — only at the rail's own 1280px breakpoint
                // is the trade real, and there the contents sidebar collapses.
                railOccupied ? 'block w-88 2xl:w-96' : 'hidden w-0',
              )}
            />
          </div>
        </ReaderRailProvider>
      </main>
    </div>
  );
}

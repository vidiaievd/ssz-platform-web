'use client';

import { useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';

import { ErrorState, LearningSkeleton, useCourseHome, useUnitContents } from '@/features/learning';
import { useActivityStreak } from '@/features/student';
import { LANG_EMOJI } from '@/features/student/course-home';

import { ContentsSidebar } from './contents-sidebar';
import { ReaderTopBar } from './reader-top-bar';
import { LessonFooterNav } from './lesson-footer-nav';
import { VocabularyPage } from './vocabulary-page';
import { TextLessonPage } from './text-lesson-page';
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
  const streak = useActivityStreak();

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
  }
  const effectiveMaxWidth = maxWidth ?? (activeKind === 'vocab' ? 780 : 680);

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
          streakDays={streak.data?.currentStreak ?? 0}
          // XP: no cumulative-XP endpoint exists yet on any service (only
          // per-item xpReward, see UnitContentsItem) — stubbed until BE adds one.
          xp={0}
        />
        <div className="flex flex-1 flex-col overflow-auto">
          <div className="mx-auto w-full flex-1 px-8 py-8" style={{ maxWidth: effectiveMaxWidth }}>
            {content}
          </div>
          {footer && <LessonFooterNav items={flatItems} activeItemId={itemId} onNext={onNextItem} />}
        </div>
      </main>
    </div>
  );
}

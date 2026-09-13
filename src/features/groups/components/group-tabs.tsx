'use client';

import { useState, type ReactNode } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';

import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { GroupHealthLine } from './group-health-line';
import { OverviewCards } from './overview-cards';
import { GroupStudentsTab } from './group-students-tab';
import { GroupTeachersTab } from './group-teachers-tab';
import { GroupScheduleTab } from './group-schedule-tab';
import { GroupProgressTab } from './group-progress-tab';
import { GroupEditDialog } from './group-edit-dialog';
import type { Group, RosterStudent, OutlineUnit, Session } from '../types';
import type { Alert } from '@/features/dashboard/types';
import { wsHref } from '@/features/workspaces/lib/href';

export type TabKey = 'overview' | 'students' | 'teachers' | 'materials' | 'schedule' | 'progress';

const ALL_TABS: TabKey[] = ['overview', 'students', 'teachers', 'materials', 'schedule', 'progress'];

type Props = {
  group: Group;
  roster: RosterStudent[];
  /** Every session of the group — the schedule & log tab reads a whole course. */
  sessions: Session[];
  /** Units of the published course, for naming what a session teaches. */
  outlineUnits: OutlineUnit[];
  /** The school's pass mark, for reading exam results. */
  passMark: number;
  /** Every teacher of the school — cover is often somebody outside the group. */
  schoolTeachers: Array<{ userId: string; name: string }>;
  /** The signed-in user — a teacher only edits the sessions they teach. */
  viewerId: string | null;
  /** Materials tab, rendered on the server — it reads the course structure. */
  materialsSlot: ReactNode;
  alerts: Alert[];
  /** Real school id (UUID) — every mutation below takes this. */
  schoolId: string;
  workspaceId: string;
  canManage: boolean;
  /** May this viewer see named learners' results — the heatmap inside the Progress tab. */
  canSeePersonalResults: boolean;
  /**
   * Which tabs this workspace has. A school has all six; a private tutor is the only
   * teacher of their group and hands out materials as assignments, so Teachers and
   * Materials would be a tab about themselves and a tab about nothing (plan 59, §5.2).
   */
  tabs?: TabKey[];
};

export function GroupTabs({
  group,
  roster,
  sessions,
  outlineUnits,
  passMark,
  schoolTeachers,
  viewerId,
  materialsSlot,
  alerts,
  schoolId,
  workspaceId,
  canManage,
  canSeePersonalResults,
  tabs = ALL_TABS,
}: Props) {
  const t = useTranslations('Groups');
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const requestedTab = searchParams.get('tab') as TabKey | null;
  // A tab this workspace does not have — a kept link, or a tab hidden since — falls back
  // to the first one rather than leaving the page with nothing selected.
  const activeTab =
    requestedTab && tabs.includes(requestedTab) ? requestedTab : (tabs[0] ?? 'overview');
  const has = (tab: TabKey) => tabs.includes(tab);
  const [editScheduleOpen, setEditScheduleOpen] = useState(false);

  function handleTabChange(tab: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (tab === 'overview') {
      params.delete('tab');
    } else {
      params.set('tab', tab);
    }
    const qs = params.toString();
    router.replace(`${pathname}${qs ? `?${qs}` : ''}`, { scroll: false });
  }

  const detailBase = wsHref(workspaceId, `groups/${group.id}`);
  const assignTeacherHref = `${detailBase}/assign-teacher`;
  const addStudentsHref   = `${detailBase}/add-students`;

  const tabLabel: Record<TabKey, string> = {
    overview: t('tabs.overview'),
    students: roster.length > 0 ? `${t('tabs.students')} ${roster.length}` : t('tabs.students'),
    teachers: t('tabs.teachers'),
    materials: t('tabs.materials'),
    schedule: t('tabs.schedule'),
    progress: t('tabs.progress'),
  };

  return (
    <>
    <Tabs value={activeTab} onValueChange={handleTabChange}>
      {/* Mobile: tabs collapse into a Select mirroring the same labels/counts (spec §8). */}
      <Select value={activeTab} onValueChange={handleTabChange}>
        <SelectTrigger className="md:hidden w-full h-11" aria-label={t('tabs.sectionLabel')}>
          <SelectValue>{tabLabel[activeTab]}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {tabs.map((tab) => (
            <SelectItem key={tab} value={tab}>
              {tabLabel[tab]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* overflow-x lives on this wrapper, not on TabsList itself: putting
          overflow-x-auto directly on TabsList forces its own overflow-y to
          compute as "auto" too (CSS's rule for a mixed visible/non-visible
          pair), and the active tab's underline sits in the -mb-0.5 zone
          TabsTrigger uses to overlap the row's own border — auto's very
          first sub-pixel of "overflow" clipped that border away entirely.
          A wrapper with no fixed height never overflows vertically on its
          own, so it can carry the horizontal scroll without touching the
          underline. */}
      <div className="hidden md:block overflow-x-auto">
        <TabsList>
          {has('overview') && <TabsTrigger value="overview">{tabLabel.overview}</TabsTrigger>}
          {has('students') && (
            <TabsTrigger value="students">
              {t('tabs.students')}
              {roster.length > 0 && (
                <Badge variant="muted" className="ml-1.5 text-[10px]">
                  {roster.length}
                </Badge>
              )}
            </TabsTrigger>
          )}
          {has('teachers') && <TabsTrigger value="teachers">{tabLabel.teachers}</TabsTrigger>}
          {has('materials') && <TabsTrigger value="materials">{tabLabel.materials}</TabsTrigger>}
          {has('schedule') && <TabsTrigger value="schedule">{tabLabel.schedule}</TabsTrigger>}
          {has('progress') && <TabsTrigger value="progress">{tabLabel.progress}</TabsTrigger>}
        </TabsList>
      </div>

      {/* ── Overview ──────────────────────────────────────────────────────── */}
      <TabsContent value="overview">
        <div className="space-y-4">
          <GroupHealthLine alerts={alerts} status={group.status} />
          <OverviewCards
            group={group}
            canManage={canManage}
            schoolId={schoolId}
            workspaceId={workspaceId}
            showTeachers={has('teachers')}
          />
        </div>
      </TabsContent>

      {/* ── Students ──────────────────────────────────────────────────────── */}
      <TabsContent value="students">
        <GroupStudentsTab
          roster={roster}
          group={group}
          schoolId={schoolId}
          workspaceId={workspaceId}
          addStudentsHref={addStudentsHref}
        />
      </TabsContent>

      {/* ── Teachers ──────────────────────────────────────────────────────── */}
      {has('teachers') && (
        <TabsContent value="teachers">
          <GroupTeachersTab
            teachers={group.teachers}
            schoolId={schoolId}
            groupId={group.id}
            assignTeacherHref={assignTeacherHref}
          />
        </TabsContent>
      )}

      {/* ── Materials ─────────────────────────────────────────────────────── */}
      {has('materials') && <TabsContent value="materials">{materialsSlot}</TabsContent>}

      {/* ── Schedule ──────────────────────────────────────────────────────── */}
      <TabsContent value="schedule">
        <GroupScheduleTab
          group={group}
          sessions={sessions}
          units={outlineUnits}
          passMark={passMark}
          roster={roster}
          schoolTeachers={schoolTeachers}
          schoolId={schoolId}
          viewerId={viewerId}
          canManage={canManage}
          onEditSchedule={() => setEditScheduleOpen(true)}
        />
      </TabsContent>

      {/* ── Progress ──────────────────────────────────────────────────────── */}
      {/* Mounted only while open: the tab fetches a projection of its own, and five
          other tabs should not wait on analytics to render. */}
      <TabsContent value="progress">
        {activeTab === 'progress' && (
          <GroupProgressTab
            schoolId={schoolId}
            groupId={group.id}
            workspaceId={workspaceId}
            canSeePersonalResults={canSeePersonalResults}
          />
        )}
      </TabsContent>
    </Tabs>

      <GroupEditDialog
        group={group}
        schoolId={schoolId}
        workspaceId={workspaceId}
        open={editScheduleOpen}
        onOpenChange={setEditScheduleOpen}
      />
    </>
  );
}
